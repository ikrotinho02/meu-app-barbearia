
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://znctbohykiwrkmrzshkh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuY3Rib2h5a2l3cmttcnpzaGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDA1NzMsImV4cCI6MjA4MDkxNjU3M30.5Dh2GsXQlOn9dq705tWikHibGKFK3wUySN5zE64Mpv4';

console.log('--- DB CLIENT INITIALIZED (dbClient.ts) ---');
console.log('AUDIT: SUPABASE URL:', supabaseUrl);
console.log('AUDIT: SUPABASE KEY:', supabaseKey);

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  // ANTI-CACHE CONFIGURATION
  // Injeta headers em todas as requisições para evitar cache de schema/dados antigos
  global: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'x-client-version': 'burn-v2-audit' // Changed to audit version
    },
  },
});
