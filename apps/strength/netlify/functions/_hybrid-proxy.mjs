/**
 * Same-origin shim onto THE-HYBRID-ENGINE1 Netlify functions.
 *
 * The athlete HTML (thehybridsystem) cannot call hybrid cross-origin —
 * those functions do not emit CORS headers. Tokens and WHOOP OAuth still
 * live only on hybrid; we just forward Authorization and the path.
 *
 * Restored after a bad cutover that copied real WHOOP handlers onto
 * thehybridsystem (env/blobs hell). hybrid1 WHOOP is still live.
 */
const HYBRID_ORIGIN = 'https://thehybridengine1.netlify.app';

export async function proxyHybrid(event, functionName) {
  const method = (event.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'authorization,content-type',
        'access-control-max-age': '86400',
      },
      body: '',
    };
  }

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const params = event.queryStringParameters || {};
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null) qs.set(k, String(v));
  }
  const q = qs.toString();
  const url = `${HYBRID_ORIGIN}/.netlify/functions/${functionName}${q ? `?${q}` : ''}`;

  const headers = { accept: 'application/json' };
  if (auth) headers.authorization = auth;
  if (event.headers['content-type']) headers['content-type'] = event.headers['content-type'];

  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    body = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64')
      : event.body;
  }

  const upstream = await fetch(url, { method, headers, body, redirect: 'manual' });
  const text = await upstream.text();
  const outHeaders = {
    'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    // Capacitor (https://localhost) and GitHub Pages call these proxies cross-origin.
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization,content-type',
  };
  const location = upstream.headers.get('location');
  if (location) outHeaders.location = location;

  return {
    statusCode: upstream.status,
    headers: outHeaders,
    body: text,
  };
}
