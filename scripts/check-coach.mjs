import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = resolve(root, 'apps/coach');
for (const entry of ['coach.html', 'index.html']) {
  const html = readFileSync(resolve(dir, entry), 'utf8');
  for (const [, asset] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    if (!/^(?:https?:|data:|#)/.test(asset) && /\.(?:js|css|html)$/.test(asset) && !existsSync(resolve(dir, asset))) {
      throw new Error(`Missing Coach asset: ${asset}`);
    }
  }
}
const checks = readdirSync(dir).filter(name => name.endsWith('.smoke.mjs')).sort();
if (!checks.length) throw new Error('No Coach checks found');
for (const name of checks) {
  const result = spawnSync(process.execPath, [resolve(dir, name)], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const imported = spawnSync(process.execPath, ['--test', resolve(dir, 'builder/library-ui.test.mjs'), resolve(dir, 'builder/brain-metadata.test.mjs')], {cwd:root,stdio:'inherit'});
if(imported.status !== 0) process.exit(imported.status || 1);
console.log(`Coach checks: ${checks.length} passed; local UI assets verified.`);
