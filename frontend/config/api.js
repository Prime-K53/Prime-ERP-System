const e = typeof import.meta!=='undefined'?import.meta.env:{};
const SUPABASE_URL = e?.VITE_SUPABASE_URL||'';
const SUPABASE_ANON_KEY = e?.VITE_SUPABASE_ANON_KEY||'';
const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL&&SUPABASE_ANON_KEY&&SUPABASE_URL!=='https://placeholder.supabase.co');
const getUrl = (p='')=>{const r=String(p).trim();if(/^(https?:\/\/|file:|blob:|data:)/i.test(r))return r;if(!SUPABASE_URL)return p;return `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/${r.replace(/^\//,'')}`};

export { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED, getUrl };
