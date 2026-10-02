const originalFetch = globalThis.fetch;

if (typeof originalFetch === 'function') {
  globalThis.fetch = async function taurusSupabaseSecretCompat(input, init = {}) {
    try {
      const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
      const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
      if (supabaseUrl && rawUrl.startsWith(supabaseUrl)) {
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        const apiKey = headers.get('apikey') || '';
        const authorization = headers.get('authorization') || '';
        if (apiKey.startsWith('sb_secret_') && authorization === `Bearer ${apiKey}`) {
          headers.delete('authorization');
          init = { ...init, headers };
        }
      }
    } catch (_) {}
    return originalFetch(input, init);
  };
}
