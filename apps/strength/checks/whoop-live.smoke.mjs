/**
 * Live WHOOP: Netlify handlers are gone. Shared Edge is the only connect path.
 */
const EDGE = 'https://orysjncrksmdfabpuftd.supabase.co/functions/v1/whoop-connect';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yeXNqbmNya3NtZGZhYnB1ZnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTE4NzksImV4cCI6MjA5OTk4Nzg3OX0.GTMBfFtH5O6SikzHo75sXGIZoEhmuJ7TvXiACd7T078';
const DEAD = [
  'https://thehybridsystem.netlify.app/.netlify/functions/whoop-connect',
  'https://thehybridengine1.netlify.app/.netlify/functions/whoop-connect',
];

if (process.env.WHOOP_LIVE_SMOKE === '0') {
  console.log('whoop-live.smoke: skipped (WHOOP_LIVE_SMOKE=0)');
  process.exit(0);
}

const failures = [];
function must(cond, msg) {
  if (!cond) failures.push(msg);
}

for (const url of DEAD) {
  const res = await fetch(url, { redirect: 'manual', cache: 'no-store' });
  must(res.status === 404, `${url} should be 404 (moved to Edge), got ${res.status}`);
}

const res = await fetch(`${EDGE}?client=native&product=strength`, {
  headers: { apikey: ANON, 'x-hybrid-product': 'strength' },
  cache: 'no-store',
});
must(res.status === 401, `Edge whoop-connect without Bearer expected 401, got ${res.status}`);
const body = await res.json().catch(() => ({}));
must(
  body.code === 'UNAUTHORIZED_NO_AUTH_HEADER' || body.error === 'unauthorized' || body.message,
  `Edge 401 body unexpected ${JSON.stringify(body)}`,
);

if (failures.length) {
  console.error('whoop-live.smoke FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('whoop-live.smoke: ok — Edge is live, Netlify WHOOP is gone');
