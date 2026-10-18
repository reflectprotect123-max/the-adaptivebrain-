import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { test, expect } from 'playwright/test';

test('moved Coach opens its offline workspace with local scripts intact', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  const errors = [];
  const missing = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith('http://127.0.0.1:8874/') && response.status() >= 400) missing.push(response.url());
  });
  await page.goto('/coach.html');
  await page.getByRole('button', { name: 'Demo coach (offline)' }).click();
  await expect(page.getByText('Coach Home', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Week 1 Day 1' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Coach Home', { exact: true }).first()).toBeVisible();
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});

async function newImportedSession(page) {
 await page.route('https://**/*',r=>r.abort());await page.goto('/coach.html');
 await page.getByRole('button',{name:'Demo coach (offline)'}).click();await page.getByRole('button',{name:'Library',exact:true}).click();
 await page.getByRole('button',{name:'New session',exact:true}).click();await expect(page.getByRole('heading',{name:'Warm-up',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await page.getByRole('button',{name:'+ Add Exercise',exact:true}).click();
 await page.getByPlaceholder('Search exercises and circuits').fill('Back Squat');
 await page.locator('.lib-pick-row').filter({has:page.getByText('Back Squat',{exact:true})}).click();
 await page.getByRole('button',{name:'Add (1)',exact:true}).click();
 await page.getByRole('button',{name:'Back',exact:true}).click();
}
async function setReps(page,n,value) {
 await page.getByRole('button',{name:`Set ${n} reps`,exact:true}).first().click();
 for(const ch of value) await page.locator('.photo-pad').getByRole('button',{name:ch,exact:true}).click();
 await page.getByRole('button',{name:'Close keypad',exact:true}).click();
}
test('APK builder authors variable reps, tempo, AMRAP, then posts and publishes the same prescription',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await newImportedSession(page);
 await expect(page.getByRole('button',{name:'Edit prescription',exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Session title',exact:true}).fill('APK import browser session');
 for(const [i,reps] of ['10','8','6'].entries()) await setReps(page,i+1,reps);
 await page.getByRole('button',{name:'Add final AMRAP',exact:true}).click();
 await expect(page.getByLabel('Set 4 AMRAP')).toBeVisible();await expect(page.getByText('Set 1 weight',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Tempo for Back Squat',exact:true}).click();await page.getByRole('button',{name:'Add tempo',exact:true}).click();
 for(const [label,value] of [['Lower','3'],['Bottom pause','3'],['Lift','X'],['Top pause','1']])await page.getByRole('textbox',{name:`${label} for Back Squat`,exact:true}).fill(value);
 await page.locator('.tempo-add').getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('button',{name:'Tempo for Back Squat',exact:true})).toHaveText('33X1');
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Cool-down',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Next',exact:true}).click();await page.locator('#sessionPostDate').fill('2026-10-19');
 await page.getByRole('button',{name:'Post to calendar',exact:true}).click();
 const chip=page.locator('.cal-chip').filter({hasText:'APK import browser session'});await expect(chip).toBeVisible();
 await chip.getByRole('button',{name:'⋯',exact:true}).click();
 await chip.getByRole('button',{name:'Publish',exact:true}).click();
 const payload=await page.evaluate(()=>{
  const session=S.sessions.find(s=>s.name==='APK import browser session');return CoachBridge.sessionForAthlete(session,'test@example.test');
 });
 expect(payload.published).toBe(true);const lift=payload.blocks.find(b=>b.title==='Back Squat');
 expect(lift.setTargets.map(t=>t.reps?.min??'AMRAP')).toEqual([10,8,6,'AMRAP']);expect(lift.tempo).toBe('33X1');expect(lift.columns).toEqual(['reps','weight_kg']);
 await page.reload();await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:/APK import browser session.*Edit/}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByRole('button',{name:'Tempo for Back Squat'})).toHaveText('33X1');
 expect(errors).toEqual([]);
});

test('returned athlete results keep metrics, load convention, canonical estimate and open state through redraw',async({page})=>{
 await page.route('https://**/*',route=>route.abort());await page.goto('/coach.html');await page.getByRole('button',{name:'Demo coach (offline)'}).click();
 await page.evaluate(()=>{
  const s=S.sessions.find(s=>s.athleteId===S.athletes[0].id);s.name=s.sessionTitle='Returned result fixture';s.date=L.today();s.status='completed';s.published=true;
  s.athleteResult={sets:[{payload:{page:{title:'Back Squat',letter:'A'},row:{ordinal:0,purpose:'amrap',kg:30,reps:13,effort:'max_effort',context:{normalizedLoad:{convention:'barbell_plates'}}}}},{payload:{page:{title:'Couch Stretch',letter:'B'},row:{ordinal:0,purpose:'working',cells:{seconds:30}}}}],estimates:[{exerciseKey:'squat',payload:{freshE1rm:69.336,confidence:'provisional'}}]};
 });
 await page.getByRole('button',{name:'Athletes',exact:true}).click();await page.getByRole('button',{name:'Calendar',exact:true}).click();
 const chip=page.locator('.cal-chip').filter({hasText:'Returned result fixture'});
 await chip.getByText('Results',{exact:true}).click();
 await expect(chip.getByText(/13 reps · 30 kg plates/)).toBeVisible();await expect(chip.getByText(/30 seconds/)).toBeVisible();await expect(chip.getByText(/69.3 kg.*athlete engine/)).toBeVisible();
 await chip.getByRole('button',{name:'⋯',exact:true}).click();await expect(chip.getByText(/13 reps · 30 kg plates/)).toBeVisible();
});

test('APK keypad enforces rep ranges and metrics survive reload without affecting logger state',async({page})=>{
 await newImportedSession(page);
 await page.getByRole('combobox',{name:'First metric for Back Squat'}).selectOption('reps_range');
 await setReps(page,1,'6–8');
 await expect(page.getByRole('button',{name:'Set 1 reps',exact:true}).first()).toHaveText('6-8');
 await page.getByRole('combobox',{name:'Second metric for Back Squat'}).selectOption('weight_lb');
 await page.getByRole('textbox',{name:'Session title'}).fill('Range and pounds');
 await page.reload();
 expect(await page.evaluate(()=>{const t=S.templates.find(t=>t.name==='Range and pounds');return t.blocks.find(b=>b.title==='Back Squat').columns;})).toEqual(['reps_range','weight_lb']);
});

test('downloaded file bundle acknowledges startup after render and retains Coach storage', async ({ page }) => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-ota-browser-'));
  try {
    execFileSync(process.execPath, ['scripts/stage-coach-capgo.mjs', stage], { cwd: root });
    await page.route('https://**/*', route => route.abort());
    await page.addInitScript(() => {
      window.CoachDesktop = { notifyAppReady() {
        window.acknowledgedAfterRender = !!(document.getElementById('gate')?.innerHTML || document.getElementById('coachApp')?.innerHTML);
      } };
    });
    await page.goto(pathToFileURL(path.join(root, 'apps/coach/coach.html')).href);
    await expect.poll(() => page.evaluate(() => window.acknowledgedAfterRender)).toBe(true);
    await page.getByRole('button', { name: 'Demo coach (offline)' }).click();
    await expect(page.getByText('Coach Home', { exact: true }).first()).toBeVisible();
    const saved = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    await page.goto(pathToFileURL(path.join(stage, 'index.html')).href);
    await expect.poll(() => page.evaluate(() => window.acknowledgedAfterRender)).toBe(true);
    await expect(page.getByText('Coach Home', { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(saved);
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
});

test('builder edits save compactly without rewriting the retired same-device athlete bridge', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/coach.html');
  await page.getByRole('button', { name: 'Demo coach (offline)' }).click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'New session', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.evaluate(() => localStorage.removeItem('THE-coach-bridge-v1'));
  await page.getByRole('textbox', { name: 'Session title', exact: true }).fill('Cleanup check');
  const saved = await page.evaluate(() => ({
    json: JSON.parse(localStorage.getItem('THE-coach-loop-v1')),
    bridge: localStorage.getItem('THE-coach-bridge-v1'),
    liveExerciseCount: S.exercises.length,
  }));
  expect(saved.liveExerciseCount).toBeGreaterThan(2000);
  expect(saved.json.exercises).toEqual([]);
  expect(saved.bridge).toBeNull();
  await page.reload();
  expect(await page.evaluate(() => S.templates.some(t => t.name === 'Cleanup check'))).toBe(true);
  expect(await page.evaluate(() => S.exercises.length)).toBeGreaterThan(2000);
});
