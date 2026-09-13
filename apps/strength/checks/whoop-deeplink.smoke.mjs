import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const manifest = join(dir, '../../mobile/capacitor/android/app/src/main/AndroidManifest.xml');
const strings = join(dir, '../../mobile/capacitor/android/app/src/main/res/values/strings.xml');

const failures = [];
function must(c, m) {
  if (!c) failures.push(m);
}

must(existsSync(manifest), 'AndroidManifest missing');
must(existsSync(strings), 'strings.xml missing');
if (existsSync(manifest) && existsSync(strings)) {
  const xml = readFileSync(manifest, 'utf8');
  const str = readFileSync(strings, 'utf8');
  must(str.includes('com.hybrid.athlete'), 'scheme com.hybrid.athlete');
  must(/android.intent.action.VIEW/.test(xml), 'VIEW intent');
  must(/android.intent.category.BROWSABLE/.test(xml), 'BROWSABLE');
}

if (failures.length) {
  console.error('brain whoop-deeplink FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('brain whoop-deeplink: ok');
