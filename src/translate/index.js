const os = require('os');
const dns = require('dns').promises;
const { URL } = require('url');

const translatorApi = module.exports;

const DEFAULT_TRANSLATOR_URL =
  process.env.TRANSLATOR_URL || 'http://128.2.220.232:5000';

function preview(s, n = 180) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

async function resolveHostFrom(urlString) {
  try {
    const u = new URL(urlString);
    if (!u.hostname) return null;
    const { address } = await dns.lookup(u.hostname);
    return { host: u.hostname, ip: address };
  } catch {
    return null;
  }
}

translatorApi.translate = async function translate(postData) {
  const content = (postData && postData.content) ? String(postData.content) : '';
  const requestUrl = `${DEFAULT_TRANSLATOR_URL}/?content=${encodeURIComponent(content)}`;
  const startedAt = Date.now();

  // High-level environment breadcrumbs
  console.log('[XLT] nodebbHost=%s pid=%s env.TRANSLATOR_URL=%s',
    os.hostname(), process.pid, process.env.TRANSLATOR_URL || '(unset)');

  // Where are we sending the request?
  const parsed = new URL(requestUrl);
  const resolved = await resolveHostFrom(requestUrl);
  console.log('[XLT] → %s %s', parsed.origin, parsed.pathname + parsed.search);
  if (resolved) {
    console.log('[XLT]   resolved %s → %s', resolved.host, resolved.ip);
  }

  // Basic timeout/abort
  const ac = new AbortController();
  const timeoutMs = Number(process.env.XLT_TIMEOUT_MS || 10000);
  const killer = setTimeout(() => ac.abort(new Error('translator timeout')), timeoutMs);

  try {
    const res = await fetch(requestUrl, { signal: ac.signal });
    clearTimeout(killer);

    const raw = await res.text();
    console.log('[XLT] ← HTTP %s %s (%d ms)', res.status, res.statusText, Date.now() - startedAt);
    console.log('[XLT]   headers:', Object.fromEntries(res.headers.entries()));
    console.log('[XLT]   body   :', preview(raw));

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error('[XLT] JSON parse error:', e.message);
      throw new Error('non-JSON body from translator');
    }

    // tolerate snake_case or camelCase
    const isEnglish = Boolean(data.isEnglish ?? data.is_english ?? false);
    const translatedContent =
      typeof data.translatedContent === 'string' ? data.translatedContent :
      typeof data.translated_content === 'string' ? data.translated_content :
      '';

    console.log('[XLT] ✓ parsed   :', { isEnglish, translatedPreview: preview(translatedContent) });

    // Always return [boolean, string]
    return [isEnglish, translatedContent || (isEnglish ? '' : content)];

  } catch (err) {
    clearTimeout(killer);
    console.error('[XLT] ✗ error    :', err && err.message ? err.message : err, `(${Date.now() - startedAt} ms)`);
    // Fallback: mark non-English and echo original so UI can degrade gracefully
    return [false, content];
  }
};
