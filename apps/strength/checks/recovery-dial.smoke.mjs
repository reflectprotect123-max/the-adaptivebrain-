import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const js = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app.js'), 'utf8');
const failures = [];
function must(c, m) {
  if (!c) failures.push(m);
}

function whoopRecoveryColor(recovery) {
  const v = Number(recovery);
  if (!Number.isFinite(v) || v <= 0) return '#16ec06';
  if (v >= 67) return '#16ec06';
  if (v >= 34) return '#ffde00';
  return '#ff0026';
}

must(js.includes('function whoopRecoveryColor'), 'whoopRecoveryColor helper in app.js');
must(js.includes('whoopRecoveryColor(m.recovery)'), 'recovery dial uses zone color');
must(whoopRecoveryColor(80) === '#16ec06', 'green at 80%');
must(whoopRecoveryColor(67) === '#16ec06', 'green at 67%');
must(whoopRecoveryColor(50) === '#ffde00', 'yellow at 50%');
must(whoopRecoveryColor(34) === '#ffde00', 'yellow at 34%');
must(whoopRecoveryColor(20) === '#ff0026', 'red at 20%');
must(whoopRecoveryColor(0) === '#16ec06', 'empty falls back to green token');

if (failures.length) {
  console.error('recovery-dial.smoke FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('recovery-dial.smoke: ok');
