import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    'Missing Supabase config. Copy .env.example to .env and fill in ' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(url ?? '', key ?? '');

// n8n Chat Trigger webhook — leave blank to disable the Ask tab
export const CHAT_WEBHOOK = import.meta.env.VITE_N8N_CHAT_WEBHOOK ?? '';
