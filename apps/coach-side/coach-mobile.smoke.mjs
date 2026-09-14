import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'coach.html'), 'utf8');
const failures = [];
function must(c, m) {
  if (!c) failures.push(m);
}

must(html.includes('viewport-fit=cover'), 'viewport-fit=cover');
must(html.includes('theme-color'), 'theme-color for Android chrome');
must(html.includes('100dvh'), 'uses 100dvh not only 100vh');
must(html.includes('env(safe-area-inset-bottom)'), 'bottom safe-area');
must(html.includes('env(safe-area-inset-top)'), 'top safe-area');
must(html.includes('--coach-tabbar-h'), 'tab bar height token');
must(html.includes('coach-nav-tabs'), 'primary tab nav');
must(html.includes('coach-more-tab'), 'More tab (max 5 phone tabs)');
must(html.includes('toggleCoachMore'), 'More sheet toggle');
must(html.includes('@media(max-width:900px)'), 'phone breakpoint');
must(html.includes('position:fixed') && html.includes('bottom:0'), 'fixed bottom tab bar on phone');
must(html.includes('font-size:16px'), '16px inputs to avoid iOS zoom');
must(!html.includes('com.hybrid.athlete://whoop'), 'no athlete WHOOP scheme');
must(html.includes('--tap:48px'), '48px tap on phone');

if (failures.length) {
  console.error('coach-mobile.smoke FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('coach-mobile.smoke: ok');
