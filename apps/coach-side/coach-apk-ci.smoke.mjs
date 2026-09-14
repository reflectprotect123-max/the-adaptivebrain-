import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const failures = [];
function must(c, m) {
  if (!c) failures.push(m);
}

const wf = join(dir, '.github/workflows/dogfood-apk.yml');
const build = join(dir, 'capacitor/scripts/build-dogfood-apk.sh');
must(existsSync(wf), '.github/workflows/dogfood-apk.yml exists');
must(existsSync(build), 'capacitor/scripts/build-dogfood-apk.sh exists');
if (existsSync(wf)) {
  const y = readFileSync(wf, 'utf8');
  must(y.includes('assembleDebug') || y.includes('build-dogfood-apk.sh'), 'workflow builds debug APK');
  must(y.includes('contents: write'), 'workflow can publish a GitHub release');
  must(y.includes('com.hybrid.coach') || y.includes('the-hybrid-coach'), 'workflow names Coach APK');
  must(!y.includes('com.hybrid.athlete'), 'workflow must not build athlete APK');
  must(y.includes('actions/setup-java'), 'workflow installs Java');
}
if (existsSync(build)) {
  const sh = readFileSync(build, 'utf8');
  must(sh.includes('assembleDebug'), 'build script assembleDebug');
  must(sh.includes('npx cap sync android'), 'build script cap sync');
  must(sh.includes('sync-coach-apk.sh'), 'build script syncs coach.html www');
  must(sh.includes('capacitor/android'), 'build script uses capacitor/android');
}

const gradle = join(dir, 'capacitor/android/app/build.gradle');
must(existsSync(gradle), 'capacitor/android/app/build.gradle exists');
if (existsSync(gradle)) {
  const g = readFileSync(gradle, 'utf8');
  must(g.includes('applicationId "com.hybrid.coach"'), 'Android applicationId com.hybrid.coach');
}
must(
  existsSync(join(dir, 'capacitor/android/gradle/wrapper/gradle-wrapper.jar')),
  'gradle-wrapper.jar is committed for GitHub Actions',
);

if (failures.length) {
  console.error('coach-apk-ci.smoke FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('coach-apk-ci.smoke: ok');
