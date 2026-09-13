import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const js = readFileSync(join(root, 'app.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const lib = readFileSync(join(root, 'library.js'), 'utf8');
const libUi = readFileSync(join(root, 'library-ui.js'), 'utf8');
const product = JSON.parse(readFileSync(join(root, 'PRODUCT.json'), 'utf8'));
const failures = [];
function must(c, m) {
  if (!c) failures.push(m);
}

must(product.hybridProduct === 'engine', 'PRODUCT.json stamp engine');
must(js.includes('THE-hybrid-engine-v1'), 'own storage key');
must(html.includes('hybrid-product" content="engine"'), 'html product stamp');
must(html.includes('The Engine'), 'Engine title');
must(html.includes('engine-config.js'), 'loads engine-config');
must(html.includes('adaptive-bundle.js'), 'loads adaptive bundle');
must(readFileSync(join(root, 'engine-config.js'), 'utf8').includes("functionsProvider: 'supabase'"), 'WHOOP uses Engine Edge Functions');
must(readFileSync(join(root, 'connectors/whoop.js'), 'utf8').includes("Browser.open"), 'native WHOOP opens Capacitor Browser');
must(readFileSync(join(root, 'connectors/whoop.js'), 'utf8').includes("appUrlOpen"), 'native WHOOP listens for Engine deep link');
must(readFileSync(join(root, 'connectors/whoop.js'), 'utf8').includes("appStateChange"), 'native WHOOP finishes if user switches back');
must(readFileSync(join(root, 'supabase/functions/_shared/http.ts'), 'utf8').includes('apikey'), 'Edge CORS allows apikey from the APK');
must(js.includes("engine-apk-1.0.5"), 'Me tab shows APK build stamp');
must(readFileSync(join(root, 'mobile/capacitor/capacitor.config.json'), 'utf8').includes('CapacitorUpdater'), 'Capgo updater in Capacitor config');
must(readFileSync(join(root, 'mobile/capacitor/package.json'), 'utf8').includes('@capgo/capacitor-updater'), 'Capgo plugin dependency');
must(readFileSync(join(root, 'engine-config.js'), 'utf8').includes('/functions/v1/www/'), 'public origin is supabase www host');
must(!readFileSync(join(root, 'engine-config.js'), 'utf8').includes('netlify'), 'engine-config has no Netlify origin');
must(!js.includes('thehybridsystem.netlify.app'), 'app.js does not call Netlify');
must(!readFileSync(join(root, 'connectors/whoop.js'), 'utf8').includes('netlify'), 'whoop.js does not call Netlify');
must(!existsSync(join(root, '.github/workflows/pages.yml')), 'GitHub Pages workflow removed');
must(existsSync(join(root, 'supabase/functions/www/index.ts')), 'Engine site is the www Edge Function');
must(existsSync(join(root, 'supabase/functions/strength/index.ts')), 'TRACK site is the strength Edge Function');
must(existsSync(join(root, 'supabase/functions/brain/index.ts')), 'Brain landing is the brain Edge Function');
must(existsSync(join(root, 'sites/strength/strength-config.js')), 'vendored TRACK config');
must(!readFileSync(join(root, 'sites/strength/connectors/whoop.js'), 'utf8').includes('netlify'), 'TRACK whoop is not Netlify');
must(!readFileSync(join(root, 'sites/strength/app.js'), 'utf8').includes('netlify'), 'TRACK app.js is not Netlify');
must(readFileSync(join(root, 'sites/strength/connectors/whoop.js'), 'utf8').includes("x-hybrid-product"), 'TRACK WHOOP sends product header');
must(!existsSync(join(root, 'supabase/functions/concept2-connect/index.ts')), 'Concept2 Logbook is retired');
must(existsSync(join(root, 'supabase/functions/off-proxy/index.ts')), 'nutrition OFF proxy is Edge');
must(html.includes('engine.js'), 'loads engine.js');
must(!html.includes('plan-sync.js'), 'Engine does not use Strength plan sync');
must(!js.includes('strength_side'), 'Engine app does not write strength_side');
must(!js.includes('PlanSync'), 'Engine app has no PlanSync');
must(!js.includes('TRAINING_DEMO'), 'no Strength HPP demo plan');
must(libUi.includes('Create Engine session'), 'Engine library create');
must(libUi.includes('>Engine session<') || libUi.includes('>Engine session</h1>'), 'editor title is Engine session');
must(!libUi.includes('Create Session Template'), 'no Strength template CTA');
must(!libUi.includes('+ Add Exercise'), 'Engine editor does not add lifts');
must(!lib.includes('Bench Press'), 'library catalog is not TRACK lifts');
must(!readFileSync(join(root, 'logger.js'), 'utf8').includes('Leave the gym already recovering'), 'logger copy is not Strength gym');
must(lib.includes("lane: kind") || lib.includes("lane: 'engine'"), 'templates are engine lane');
must(readFileSync(join(root, 'engine.js'), 'utf8').includes('softenOpen'), 'Open applies WHOOP soften');
must(readFileSync(join(root, 'logger.js'), 'utf8').includes('skipRestAndStart'), 'Skip rest starts next work');
must(!readFileSync(join(root, 'engine.js'), 'utf8').includes('decideNextLift'), 'Engine product never calls lift Next');
must(readFileSync(join(root, 'logger.js'), 'utf8').includes('engineEffort'), 'rest EMH effort buttons');
must(readFileSync(join(root, 'logger.js'), 'utf8').includes('How was that interval'), 'EMH prompt on rest');
must(!readFileSync(join(root, 'logger.js'), 'utf8').includes('engineRate'), 'RPE rate removed');
must(readFileSync(join(root, 'engine.js'), 'utf8').includes('decideNextEngine'), 'Next uses brain kernel');
must(readFileSync(join(root, 'engine.js'), 'utf8').includes('recordEffort'), 'recordEffort replaces rateWork');
must(readFileSync(join(root, 'app.js'), 'utf8').includes('ath-zones'), 'home zone card');
must(readFileSync(join(root, 'index.html'), 'utf8').includes('brain-kernel.js'), 'loads brain kernel');
must(js.includes('function trnEngineHtml'), 'Training Engine cards');
must(js.includes('THE-hybrid-engine-v1') && !js.includes("STORAGE_KEY = 'THE-brain-v1'"), 'storage is not the Strength key');

for (const f of ['app.js', 'logger.js', 'engine.js', 'session.js', 'library.js', 'library-ui.js']) {
  const r = spawnSync('node', ['--check', join(root, f)], { encoding: 'utf8' });
  must(r.status === 0, `${f} parses (${(r.stderr || '').trim() || 'ok'})`);
}

if (failures.length) {
  console.error('engine-app.smoke FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('engine-app.smoke: ok');
