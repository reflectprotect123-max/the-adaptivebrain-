/**
 * Live WHOOP production smoke.
 *
 * Hits real Netlify endpoints. Fails if:
 *  - athlete site stopped proxying (redirect_uri points at itself)
 *  - hybrid1 owner is down / not issuing OAuth
 *  - athlete and hybrid1 disagree on redirect_uri host
 *  - native auth gate regresses
 *
 * Env:
 *   WHOOP_LIVE_SMOKE=0  — skip (local offline). CI/deploy must NOT set this.
 *
 * Run: node apps/brain-app/checks/whoop-live.smoke.mjs
 */
const OWNER = 'https://thehybridengine1.netlify.app';
const ATHLETE = 'https://thehybridsystem.netlify.app';
const OWNER_HOST = 'thehybridengine1.netlify.app';
const ATHLETE_HOST = 'thehybridsystem.netlify.app';

if (process.env.WHOOP_LIVE_SMOKE === '0') {
  console.log('whoop-live.smoke: skipped (WHOOP_LIVE_SMOKE=0)');
  process.exit(0);
}

const failures = [];
function must(cond, msg) {
  if (!cond) failures.push(msg);
}

async function fetchRes(url, opts = {}) {
  const res = await fetch(url, { redirect: 'manual', cache: 'no-store', ...opts });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  return { status: res.status, headers: res.headers, text, json };
}

function redirectUriHost(location) {
  if (!location) return null;
  try {
    const u = new URL(location);
    const ru = u.searchParams.get('redirect_uri');
    if (!ru) return null;
    return new URL(ru).hostname;
  } catch (_) {
    return null;
  }
}

async function checkConnect(label, base) {
  const r = await fetchRes(`${base}/.netlify/functions/whoop-connect`);
  must(r.status === 302, `${label} whoop-connect expected 302, got ${r.status}`);
  const loc = r.headers.get('location') || '';
  must(/api\.prod\.whoop\.com/.test(loc), `${label} whoop-connect Location must be WHOOP authorize`);
  const host = redirectUriHost(loc);
  must(host === OWNER_HOST, `${label} redirect_uri host must be ${OWNER_HOST}, got ${host}`);
  must(host !== ATHLETE_HOST, `${label} redirect_uri must NOT be athlete site (real-handler cutover)`);
  return host;
}

async function checkNativeAuthGate(label, base) {
  const r = await fetchRes(`${base}/.netlify/functions/whoop-connect?client=native`);
  must(r.status === 401, `${label} native connect without Bearer expected 401, got ${r.status}`);
  const err = (r.json && r.json.error) || '';
  must(
    err === 'authentication_required' || err === 'unauthorized',
    `${label} native 401 body error got ${JSON.stringify(r.json)}`,
  );
}

async function checkStatus(label, base) {
  const r = await fetchRes(`${base}/.netlify/functions/integrations-status`);
  must(r.status === 200, `${label} integrations-status expected 200, got ${r.status}`);
  must(r.json && r.json.whoop && typeof r.json.whoop.connected === 'boolean', `${label} status missing whoop.connected`);
}

async function checkOffProxy() {
  const path = encodeURIComponent(
    '/cgi/search.pl?action=process&search_terms=milk&json=1&page_size=1&page=1',
  );
  const r = await fetchRes(`${ATHLETE}/.netlify/functions/off-proxy?path=${path}`);
  must(r.status === 200, `off-proxy expected 200, got ${r.status}: ${(r.text || '').slice(0, 120)}`);
  must(r.json && (Array.isArray(r.json.products) || r.json.count != null), 'off-proxy JSON missing products/count');
}

const retries = Math.max(1, Number(process.env.WHOOP_LIVE_RETRIES || 3));
const delayMs = Math.max(500, Number(process.env.WHOOP_LIVE_RETRY_MS || 4000));

let lastErr = null;
for (let i = 1; i <= retries; i++) {
  failures.length = 0;
  try {
    const athleteHost = await checkConnect('athlete', ATHLETE);
    const ownerHost = await checkConnect('owner', OWNER);
    must(athleteHost === ownerHost, `athlete/owner redirect_uri hosts diverge: ${athleteHost} vs ${ownerHost}`);
    await checkNativeAuthGate('athlete', ATHLETE);
    await checkNativeAuthGate('owner', OWNER);
    await checkStatus('athlete', ATHLETE);
    await checkStatus('owner', OWNER);
    await checkOffProxy();
    if (!failures.length) {
      console.log(
        `whoop-live.smoke: ok (attempt ${i}/${retries}) — proxy→${OWNER_HOST}, athlete=${ATHLETE_HOST}`,
      );
      process.exit(0);
    }
  } catch (e) {
    lastErr = e;
    failures.push(String(e && e.message ? e.message : e));
  }
  if (i < retries) {
    console.warn(`whoop-live.smoke: attempt ${i} failed, retrying in ${delayMs}ms…`);
    for (const f of failures) console.warn(' -', f);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

console.error('whoop-live.smoke FAIL');
for (const f of failures) console.error(' -', f);
if (lastErr) console.error(lastErr);
process.exit(1);
