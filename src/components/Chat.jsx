import { useEffect, useRef, useState } from 'react';
import { CHAT_WEBHOOK } from '../supabase';

export default function Chat({ userId }) {
  const [msgs, setMsgs] = useState([
    { who: 'bot', text: "Ask me about fees, programmes, credit points, clubs or campus life at GUtech." },
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send() {
    const q = text.trim();
    if (!q || busy) return;

    if (!CHAT_WEBHOOK) {
      setMsgs(m => [...m, { who: 'me', text: q },
        { who: 'sys', text: 'Chat webhook not configured — add VITE_N8N_CHAT_WEBHOOK to .env' }]);
      setText('');
      return;
    }

    setMsgs(m => [...m, { who: 'me', text: q }]);
    setText('');
    setBusy(true);

    try {
      const res = await fetch(CHAT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatInput: q, sessionId: userId, action: 'sendMessage' }),
      });
      const data = await res.json();
      const reply = data.output ?? data.text ?? data.response
        ?? "That didn't come back in a format I could read.";
      setMsgs(m => [...m, { who: 'bot', text: reply }]);
    } catch {
      setMsgs(m => [...m, { who: 'sys', text: "Couldn't reach the assistant. Check the webhook URL and that the n8n workflow is active." }]);
    }
    setBusy(false);
  }

  return (
    <>
      <div className="annot">Ask</div>
      <div className="thread">
        {msgs.map((m, i) => (
          <div className={`bubble ${m.who === 'me' ? 'me' : m.who === 'sys' ? 'sys' : 'bot'}`} key={i}>
            {m.text}
          </div>
        ))}
        {busy && <div className="bubble sys">Looking it up</div>}
        <div ref={end} />
      </div>

      <div className="composer">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type a question"
          aria-label="Your question"
        />
        <button onClick={send} disabled={busy || !text.trim()}>Send</button>
      </div>
    </>
  );
}
