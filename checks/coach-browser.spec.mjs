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

test('prescription editor accepts variable reps without detached inputs and keeps unprescribed kg',async({page})=>{
 await page.route('https://**/*',route=>route.abort());const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/coach.html');await page.getByRole('button',{name:'Demo coach (offline)'}).click();
 await page.getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('button',{name:'New session',exact:true}).click();
 await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Edit prescription',exact:true}).click();
 const d=page.locator('details').filter({has:page.getByText('Set sets & reps',{exact:true})});
 await d.getByRole('spinbutton').fill('4');await d.getByRole('spinbutton').press('Tab');
 // Ordinary typing must retain focus/caret through the redraw.
 await page.getByRole('textbox',{name:'Target reps or effort',exact:true}).fill('');
 await page.getByRole('textbox',{name:'Target reps or effort',exact:true}).pressSequentially('10');
 await page.getByText('Per-set rep overrides (optional)',{exact:true}).click();
 const over=page.locator('details').filter({has:page.getByText('Per-set rep overrides (optional)',{exact:true})});
 await over.getByRole('textbox').nth(1).fill('8');await over.getByRole('textbox').nth(2).fill('6');await over.getByRole('textbox').nth(3).fill('AMRAP');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.getByText(/4 × 10, 8, 6, AMRAP/)).toBeVisible();
 await page.getByRole('textbox',{name:'Tempo for Back Squat'}).fill('33X1');
 const ex=await page.evaluate(()=>S.templates.at(-1).blocks.find(b=>b.exercises?.some(e=>e.name==='Back Squat')).exercises[0]);
 expect(ex.logColumns.some(c=>c.kind==='weight_kg')).toBe(true);expect(ex.tempo).toBe('33X1');expect(errors).toEqual([]);
 await page.getByRole('button',{name:'Edit prescription',exact:true}).click();
 await expect(page.getByText('How hard was that set?Average · RIR ~3',{exact:true})).toBeVisible();
 await expect(page.getByRole('slider',{name:'Difficulty slider preview'})).toHaveAttribute('max','4');
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
