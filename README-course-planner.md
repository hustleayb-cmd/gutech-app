# Course Planner — setup

This feature calls OpenAI and the Google Docs/Slides API from a Supabase
Edge Function (`supabase/functions/course-planner/`), never from the
browser, so the keys never ship to a student's device.

## 1. Google Cloud API key

1. [console.cloud.google.com](https://console.cloud.google.com) → create or pick a project
2. **APIs & Services → Library** → enable **Google Docs API** and **Google Slides API**
3. **APIs & Services → Credentials → Create Credentials → API key**
4. Copy the key

This only works for docs/slides shared as **"Anyone with the link can view"** —
reading a privately-shared doc would need full OAuth, which needs Google's
app-verification review (a multi-week process), so this version
deliberately skips that.

## 2. OpenAI API key

You said you already have one with billing set up — same key, no changes needed.

## 3. Install and authenticate the Supabase CLI (on your machine)

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

Find `<your-project-ref>` in your Supabase dashboard URL:
`supabase.com/dashboard/project/<this-part>`

## 4. Set the secrets

```bash
supabase secrets set OPENAI_API_KEY=sk-your-key-here
supabase secrets set GOOGLE_API_KEY=your-google-key-here
```

Never put these in `.env` or commit them — `supabase secrets` stores them
server-side, attached to the Edge Function's runtime only.

## 5. Deploy the function

```bash
supabase functions deploy course-planner
```

## 6. Run the updated schema.sql

Same as always — paste the full `schema.sql` into the Supabase SQL editor
and run it. This adds `courses`, `course_materials`, `course_topics`,
`course_checklist_items`, `course_chat_messages`.

## Testing it once deployed

From the browser console (or once the frontend is built), the call shape is:

```js
const { data, error } = await supabase.functions.invoke('course-planner', {
  body: { action: 'generate', courseId: '...', sourceLink: 'https://docs.google.com/document/d/.../edit' },
});
```

Pick a real Google Doc you own, share it as "Anyone with the link can
view," and test with that one document before building any UI on top —
per your own build order.
