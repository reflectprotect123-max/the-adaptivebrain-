import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const failures = [];
function must(cond, msg) {
  if (!cond) failures.push(msg);
}

const forbiddenPaths = [
  'archive/pre-brain',
  'apps/mobile/prototype',
  'apps/mobile/preview-site',
  'apps/hybrid-strength',
  'apps/hybrid-engine',
  'scripts/archive-pre-brain.sh',
  'scripts/extract-hybrid-apps.sh',
  'scripts/hybrid-products.json',
];

for (const rel of forbiddenPaths) {
  must(!existsSync(join(root, rel)), `recall path must not exist: ${rel}`);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const scripts = Object.values(pkg.scripts || {}).join('\n');
must(!scripts.includes('sync-hybrid-html'), 'package.json must not reference sync-hybrid-html');

if (existsSync(join(root, 'archive'))) {
  const archiveEntries = readdirSync(join(root, 'archive'));
  must(!archiveEntries.includes('pre-brain'), 'archive/pre-brain must be gone');
}

if (failures.length) {
  console.error('no-recall.smoke FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('no-recall.smoke: ok');
