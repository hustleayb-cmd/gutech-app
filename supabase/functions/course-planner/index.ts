// Supabase Edge Function — the only place that ever touches the
// OpenAI and Google Docs/Slides/Drive API keys. Deploy with:
//   supabase functions deploy course-planner
// Requires these secrets set first (see README-course-planner.md):
//   supabase secrets set OPENAI_API_KEY=sk-...
//   supabase secrets set GOOGLE_API_KEY=...
// GOOGLE_API_KEY's project needs Docs API, Slides API, AND Drive API
// all enabled — Drive API is what lets this read PDFs/Word docs, not
// just native Google Docs/Slides.
//
// Two actions, dispatched by `action` in the POST body:
//   "generate" — fetch a Drive link (Doc, Slides, PDF, or Word doc),
//                ask OpenAI to break it into topics + a grounded
//                checklist, save both.
//   "explain"  — answer a question about one checklist item, grounded
//                in the same source content, scoped to that topic.
//
// PDF/DOCX extraction is new and untested against a real file as of
// this writing (no local Deno runtime or live credentials available
// while writing it) — verify it actually works before relying on it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractText as extractPdfText } from 'https://esm.sh/unpdf@0.11.0';
import mammoth from 'https://esm.sh/mammoth@1.8.0';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
// Needs actual vision/file-reading support — gpt-4o-mini's file
// handling is weaker than gpt-4o's, so this defaults to the larger
// model specifically for the PDF-vision path (costs more per call).
const VISION_MODEL = Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-4o';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a study-material summarizer for university students.
Use ONLY the content given to you below — never invent facts, names, dates, or
details that are not explicitly present in the source text. If the source is
too thin to produce a topic, say so in that topic's summary rather than
padding it with outside knowledge.

Return strict JSON matching this shape, nothing else:
{
  "topics": [
    {
      "title": "string",
      "summary": "one or two sentences, grounded in the source",
      "checklist": ["specific, concrete study action grounded in the source", "..."]
    }
  ]
}
Order topics in a sensible study sequence (foundational concepts first).
Checklist items must be concrete and actionable — reference specific
content from the source, never generic advice like "study this topic".`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    if (!OPENAI_API_KEY || !GOOGLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Server is missing required secrets (OPENAI_API_KEY / GOOGLE_API_KEY / service role).' }, 500);
    }

    // Identify the calling student from their JWT (the client passes its
    // own session token automatically via supabase.functions.invoke()).
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Not signed in.' }, 401);
    const userId = userData.user.id;

    // Service-role client for the actual writes, after we've confirmed
    // above who's asking and (below) that they own the course in question.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();

    if (body.action === 'generate') {
      return await handleGenerate(admin, userId, body);
    }
    if (body.action === 'explain') {
      return await handleExplain(admin, userId, body);
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
  }
});

async function handleGenerate(admin: ReturnType<typeof createClient>, userId: string, body: any) {
  const { courseId, sourceLink } = body;
  if (!courseId || !sourceLink) return json({ error: 'courseId and sourceLink are required.' }, 400);

  const { data: course } = await admin.from('courses').select('id').eq('id', courseId).eq('user_id', userId).maybeSingle();
  if (!course) return json({ error: 'Course not found or not yours.' }, 404);

  const fetched = await fetchGoogleDocContent(sourceLink);

  // Diagram/image-heavy PDFs: plain text extraction alone misses too
  // much (confirmed during testing — a mostly-visual slide deck PDF
  // only yields the sparse text objects, none of the diagram content).
  // For PDFs specifically, hand the actual file to a vision-capable
  // model instead of just its extracted text, so it can read diagrams
  // the same way a student looking at the page would.
  let topics;
  if (fetched.pdfBytes) {
    topics = await generateTopicsFromPdfVision(fetched.pdfBytes, fetched.filename ?? 'source.pdf');
  } else {
    if (!fetched.text || fetched.text.trim().length < 40) {
      return json({ error: "Couldn't read enough content from that link — make sure it's shared as \"Anyone with the link can view\"." }, 422);
    }
    topics = await generateTopics(fetched.text);
  }

  await admin.from('course_materials').insert({
    course_id: courseId, source_link: sourceLink, extracted_content: (fetched.text ?? '').slice(0, 100000), last_synced_at: new Date().toISOString(),
  });

  // Replace any previous breakdown for this course on regenerate.
  const { data: oldTopics } = await admin.from('course_topics').select('id').eq('course_id', courseId);
  if (oldTopics?.length) await admin.from('course_topics').delete().in('id', oldTopics.map(t => t.id));

  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    const { data: topicRow, error: topicErr } = await admin
      .from('course_topics')
      .insert({ course_id: courseId, title: t.title, summary: t.summary, position: i })
      .select()
      .single();
    if (topicErr) return json({ error: topicErr.message }, 500);

    const items = (t.checklist ?? []).map((title: string, pos: number) => ({ topic_id: topicRow.id, title, position: pos }));
    if (items.length) await admin.from('course_checklist_items').insert(items);
  }

  return json({ ok: true, topicCount: topics.length });
}

async function handleExplain(admin: ReturnType<typeof createClient>, userId: string, body: any) {
  const { topicId, itemId, question } = body;
  if (!topicId || !question) return json({ error: 'topicId and question are required.' }, 400);

  const { data: topic } = await admin
    .from('course_topics')
    .select('id, title, summary, course_id, courses!inner(user_id)')
    .eq('id', topicId)
    .maybeSingle();
  if (!topic || (topic as any).courses.user_id !== userId) return json({ error: 'Topic not found or not yours.' }, 404);

  const { data: material } = await admin
    .from('course_materials').select('extracted_content').eq('course_id', topic.course_id)
    .order('last_synced_at', { ascending: false }).limit(1).maybeSingle();

  const answer = await callOpenAI([
    { role: 'system', content: `You are a study helper answering a question about the topic "${topic.title}". Answer ONLY using this source material, and say so plainly if the source doesn't cover it:\n\n${(material?.extracted_content ?? '').slice(0, 12000)}` },
    { role: 'user', content: question },
  ], { json: false });

  await admin.from('course_chat_messages').insert([
    { topic_id: topicId, checklist_item_id: itemId ?? null, role: 'user', content: question },
    { topic_id: topicId, checklist_item_id: itemId ?? null, role: 'assistant', content: answer },
  ]);

  return json({ answer });
}

interface FetchedContent {
  text?: string;
  pdfBytes?: Uint8Array;
  filename?: string;
}

// ---- Content extraction: native Docs/Slides, plus uploaded PDF/Word
// files via the Drive API. Any of these link shapes work:
//   docs.google.com/document/d/{id}/...        (native Google Doc)
//   docs.google.com/presentation/d/{id}/...    (native Google Slides)
//   drive.google.com/file/d/{id}/...           (uploaded PDF, .docx, etc.)
// PDFs return their raw bytes too (see pdfBytes) so the caller can hand
// the actual file to a vision model instead of relying only on
// extracted text, which misses diagram/image content.
async function fetchGoogleDocContent(link: string): Promise<FetchedContent> {
  const docMatch = link.match(/document\/d\/([a-zA-Z0-9_-]+)/);
  const slideMatch = link.match(/presentation\/d\/([a-zA-Z0-9_-]+)/);
  const fileMatch = link.match(/file\/d\/([a-zA-Z0-9_-]+)/) || link.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (docMatch) return { text: await fetchNativeDoc(docMatch[1]) };
  if (slideMatch) return { text: await fetchNativeSlides(slideMatch[1]) };

  if (fileMatch) {
    const fileId = fileMatch[1];
    // Ask Drive what this actually is before deciding how to read it —
    // an uploaded file could be a native Doc/Slides shortcut, a PDF, a
    // Word doc, or something we don't support at all.
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name&key=${GOOGLE_API_KEY}`);
    if (!metaRes.ok) {
      const detail = await metaRes.text().catch(() => '');
      throw new Error(`Google Drive API error (${metaRes.status}): ${detail}`);
    }
    const meta = await metaRes.json();
    const mime = meta.mimeType as string;
    const filename = meta.name as string | undefined;

    if (mime === 'application/vnd.google-apps.document') return { text: await fetchNativeDoc(fileId) };
    if (mime === 'application/vnd.google-apps.presentation') return { text: await fetchNativeSlides(fileId) };

    if (mime === 'application/pdf') {
      const bytes = new Uint8Array(await downloadDriveFile(fileId));
      const { text } = await extractPdfText(bytes, { mergePages: true }).catch(() => ({ text: '' }));
      return { text: (Array.isArray(text) ? text.join('\n') : text).trim(), pdfBytes: bytes, filename };
    }

    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const bytes = await downloadDriveFile(fileId);
      const result = await mammoth.extractRawText({ arrayBuffer: bytes });
      return { text: (result.value ?? '').trim() };
    }

    throw new Error(`This file type (${mime}) isn't supported yet — only native Google Docs/Slides, PDF, and .docx are.`);
  }

  throw new Error('Link must be a docs.google.com or drive.google.com file link.');
}

async function fetchNativeDoc(id: string): Promise<string> {
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${id}?key=${GOOGLE_API_KEY}`);
  if (!res.ok) throw new Error(`Google Docs API error (${res.status}) — check the link is publicly viewable and the Docs API is enabled.`);
  return flattenDocsContent(await res.json());
}

async function fetchNativeSlides(id: string): Promise<string> {
  const res = await fetch(`https://slides.googleapis.com/v1/presentations/${id}?key=${GOOGLE_API_KEY}`);
  if (!res.ok) throw new Error(`Google Slides API error (${res.status}) — check the link is publicly viewable and the Slides API is enabled.`);
  return flattenSlidesContent(await res.json());
}

async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`);
  if (!res.ok) throw new Error(`Google Drive download error (${res.status}) — check the file is shared as "Anyone with the link".`);
  return await res.arrayBuffer();
}

function flattenDocsContent(doc: any): string {
  const out: string[] = [];
  for (const el of doc?.body?.content ?? []) {
    for (const run of el?.paragraph?.elements ?? []) {
      if (run?.textRun?.content) out.push(run.textRun.content);
    }
  }
  return out.join('').trim();
}

function flattenSlidesContent(pres: any): string {
  const out: string[] = [];
  for (const slide of pres?.slides ?? []) {
    for (const el of slide?.pageElements ?? []) {
      for (const run of el?.shape?.text?.textElements ?? []) {
        if (run?.textRun?.content) out.push(run.textRun.content);
      }
    }
    out.push('\n');
  }
  return out.join('').trim();
}

// ---- OpenAI ----
async function generateTopics(sourceContent: string) {
  const raw = await callOpenAI([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: sourceContent.slice(0, 40000) },
  ], { json: true });
  const parsed = JSON.parse(raw);
  return parsed.topics ?? [];
}

// Vision path for diagram/image-heavy PDFs — uploads the actual file to
// OpenAI and asks a vision-capable model to read it directly (including
// diagrams/screenshots), via the Responses API's file input support.
// This is new, unverified against a real PDF as of writing — if the
// response parsing below doesn't match what the API actually returns,
// that's the first thing to check.
async function generateTopicsFromPdfVision(pdfBytes: Uint8Array, filename: string) {
  const fileId = await uploadFileToOpenAI(pdfBytes, filename);
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        input: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'input_file', file_id: fileId },
              { type: 'input_text', text: 'Read this document — including any diagrams, charts, or screenshots — and break it into topics per the system instructions.' },
            ],
          },
        ],
        text: { format: { type: 'json_object' } },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI Responses API error (${res.status}): ${await res.text()}`);
    const data = await res.json();

    // The Responses API's exact output shape has shifted across
    // versions — try the documented `output_text` convenience field
    // first, then fall back to walking `output[].content[]`.
    const raw = data.output_text
      ?? data.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === 'output_text' || c.text)?.text
      ?? '';
    if (!raw) throw new Error('OpenAI Responses API returned no text — response shape may have changed, check the raw payload.');

    const parsed = JSON.parse(raw);
    return parsed.topics ?? [];
  } finally {
    // Best-effort cleanup — don't fail the whole request if this fails.
    fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    }).catch(() => {});
  }
}

async function uploadFileToOpenAI(bytes: Uint8Array, filename: string): Promise<string> {
  const form = new FormData();
  form.append('purpose', 'user_data');
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), filename);

  const res = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI file upload error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

async function callOpenAI(messages: { role: string; content: string }[], opts: { json: boolean }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
