/** Build only the browser UI; never upload desktop code, fixtures or credentials. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'apps/coach');
const output = path.resolve(process.argv[2] || path.join(root, 'apps/desktop/dist/coach-ui'));
if (output === root || output === source || source.startsWith(output + path.sep)) throw new Error('Unsafe staging directory');
fs.mkdirSync(output, { recursive: true });
if (fs.readdirSync(output).length) throw new Error('Staging directory must be empty');
for (const entry of fs.readdirSync(source)) {
  if (entry === 'icons') fs.cpSync(path.join(source, entry), path.join(output, entry), { recursive: true });
  else if (/\.(js|html)$/.test(entry)) fs.copyFileSync(path.join(source, entry), path.join(output, entry));
}
// SDK loads www/index.html. Keep the Coach document there, rather than a redirect.
fs.copyFileSync(path.join(source, 'coach.html'), path.join(output, 'index.html'));
const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
if (!html.includes('notifyAppReady()')) throw new Error('Coach health acknowledgement missing');
for (const [, asset] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  if (!/^(?:https?:|data:|#)/.test(asset) && !fs.existsSync(path.join(output, asset))) throw new Error(`Missing bundle asset: ${asset}`);
}
console.log(`Coach UI staged: ${output}`);
