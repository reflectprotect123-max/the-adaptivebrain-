import { json, method, preflight } from './_lib/http.mjs';

const OFF_ORIGINS = [
  'https://world.openfoodfacts.org',
  'https://world.openfoodfacts.net',
];
const UA = 'TheStrengthEngine/1.0 (netlify off-proxy; contact=dogfood)';

function allowedPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return false;
  if (path.startsWith('/cgi/search.pl')) return true;
  if (path.startsWith('/api/v2/product/')) return true;
  if (path.startsWith('/api/v0/product/')) return true;
  return false;
}

async function fetchOff(path) {
  let lastErr = null;
  for (const origin of OFF_ORIGINS) {
    try {
      const res = await fetch(origin + path, {
        headers: { accept: 'application/json', 'user-agent': UA },
      });
      const ct = String(res.headers.get('content-type') || '');
      if (!res.ok) {
        lastErr = new Error('OFF HTTP ' + res.status);
        continue;
      }
      if (ct.includes('text/html')) {
        lastErr = new Error('OFF unavailable');
        continue;
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('OFF failed');
}

export async function handler(event) {
  const options = preflight(event);
  if (options) return options;
  const denied = method(event, ['GET']);
  if (denied) return denied;
  const path = decodeURIComponent(String(event.queryStringParameters?.path || ''));
  if (!allowedPath(path)) {
    return json({ error: 'path_not_allowed' }, 400, { 'cache-control': 'no-store' });
  }
  try {
    const data = await fetchOff(path);
    return json(data, 200, { 'cache-control': 'public, max-age=300' });
  } catch (e) {
    return json({ error: 'off_unavailable', message: String(e?.message || e) }, 502, {
      'cache-control': 'no-store',
    });
  }
}
