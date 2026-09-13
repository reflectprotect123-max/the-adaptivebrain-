import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require(join(dirname(fileURLToPath(import.meta.url)), 'timer.js'));
const HybridTimer = globalThis.HybridTimer;

test('picker lists the seven TrainHeroic modes in clip-1 order', () => {
  assert.deepEqual(HybridTimer.PICKER.map((m) => m.label), [
    'Rest Timer',
    'Stopwatch',
    'AMRAP',
    'For Time',
    'Tabata',
    'Custom Interval',
    'EMOM',
  ]);
});

test('fresh timer idle has no last rest so chrome is select', () => {
  const t = HybridTimer.create();
  const snap = HybridTimer.snapshot(t, 0);
  assert.equal(snap.view, 'idle');
  assert.equal(snap.chrome, 'select');
});

test('openPicker then rest setup defaults to 1:00', () => {
  let t = HybridTimer.create();
  t = HybridTimer.openPicker(t);
  t = HybridTimer.choose(t, 'rest');
  const snap = HybridTimer.snapshot(t, 0);
  assert.equal(snap.view, 'setup');
  assert.equal(snap.mode, 'rest');
  assert.equal(snap.config.restMs, 60000);
});

test('quick start 2:00 then Start begins rest with no count-in', () => {
  let t = HybridTimer.create();
  t = HybridTimer.choose(HybridTimer.openPicker(t), 'rest');
  t = HybridTimer.quickStart(t, 120000);
  t = HybridTimer.start(t, 1000);
  const snap = HybridTimer.snapshot(t, 1000);
  assert.equal(snap.view, 'running');
  assert.equal(snap.display, 'fullscreen');
  assert.equal(snap.remainingMs, 120000);
  assert.equal(snap.countInLabel, null);
});

test('rest remaining drops and formats tenths', () => {
  let t = HybridTimer.create();
  t = HybridTimer.choose(HybridTimer.openPicker(t), 'rest');
  t = HybridTimer.start(t, 0);
  const snap = HybridTimer.snapshot(t, 2400);
  assert.equal(snap.remainingMs, 57600);
  assert.equal(snap.clock, '0:57.6');
});

test('collapse keeps rest running; docked clock has no tenths', () => {
  let t = HybridTimer.create();
  t = HybridTimer.choose(HybridTimer.openPicker(t), 'rest');
  t = HybridTimer.start(t, 0);
  t = HybridTimer.collapse(t);
  const snap = HybridTimer.snapshot(t, 1000);
  assert.equal(snap.display, 'docked');
  assert.equal(snap.clock, '0:59');
});

test('play replays last rest with docked GET READY then GO then remaining', () => {
  let t = HybridTimer.create();
  t = HybridTimer.choose(HybridTimer.openPicker(t), 'rest');
  t = HybridTimer.quickStart(t, 120000);
  t = HybridTimer.start(t, 0);
  t = HybridTimer.stop(t);
  assert.equal(HybridTimer.snapshot(t, 0).chrome, 'play');
  t = HybridTimer.play(t, 10_000);
  assert.equal(HybridTimer.snapshot(t, 10_000).countInLabel, 'GET READY!');
  assert.equal(HybridTimer.snapshot(t, 10_000).display, 'docked');
  assert.equal(HybridTimer.snapshot(t, 11_000).countInLabel, '5');
  assert.equal(HybridTimer.snapshot(t, 15_000).countInLabel, '1');
  assert.equal(HybridTimer.snapshot(t, 16_000).countInLabel, 'GO!');
  const run = HybridTimer.snapshot(t, 16_700);
  assert.equal(run.view, 'running');
  assert.equal(run.display, 'docked');
  assert.ok(run.remainingMs <= 120000);
  assert.ok(run.remainingMs > 119000);
});

test('tick commits play rest from count-in into running then idle play when done', () => {
  let t = HybridTimer.create();
  t = HybridTimer.choose(HybridTimer.openPicker(t), 'rest');
  t = HybridTimer.quickStart(t, 120000);
  t = HybridTimer.start(t, 0);
  t = HybridTimer.stop(t);
  t = HybridTimer.play(t, 10_000);
  assert.equal(t.view, 'countIn');
  t = HybridTimer.tick(t, 16_700);
  assert.equal(t.view, 'running');
  assert.equal(t.display, 'docked');
  assert.ok(t.startedAt);
  t = HybridTimer.tick(t, t.startedAt + 120000);
  assert.equal(t.view, 'idle');
  assert.equal(HybridTimer.snapshot(t, t.startedAt + 120000).chrome, 'play');
});

test('reduced motion count-in is digits only then running', () => {
  let t = HybridTimer.create();
  t.reducedMotion = true;
  t = HybridTimer.choose(HybridTimer.openPicker(t), 'forTime');
  t = HybridTimer.start(t, 0);
  assert.equal(HybridTimer.snapshot(t, 0).countInLabel, '5');
  assert.equal(HybridTimer.snapshot(t, 400).countInLabel, '5');
  t = HybridTimer.tick(t, 5000);
  assert.equal(t.view, 'running');
});

test('stop sheet cancel keeps running; stop returns idle play', () => {
  let t = HybridTimer.create();
  t = HybridTimer.choose(HybridTimer.openPicker(t), 'rest');
  t = HybridTimer.start(t, 0);
  t = HybridTimer.collapse(t);
  t = HybridTimer.openStopSheet(t);
  assert.equal(HybridTimer.snapshot(t, 500).stopSheet, true);
  t = HybridTimer.cancelStopSheet(t);
  assert.equal(HybridTimer.snapshot(t, 500).view, 'running');
  t = HybridTimer.openStopSheet(t);
  t = HybridTimer.stop(t);
  const snap = HybridTimer.snapshot(t, 500);
  assert.equal(snap.view, 'idle');
  assert.equal(snap.chrome, 'play');
  assert.equal(snap.stopSheet, false);
});

test('EMOM running shows round fraction and countdown', () => {
  let t = HybridTimer.create();
  t = HybridTimer.choose(HybridTimer.openPicker(t), 'emom');
  t = HybridTimer.patch(t, { everyMs: 120000, rounds: 4, countInMs: 0 });
  t = HybridTimer.start(t, 0);
  const snap = HybridTimer.snapshot(t, 1100);
  assert.equal(snap.view, 'running');
  assert.equal(snap.roundLabel, 'Round 1');
  assert.equal(snap.roundFraction, '1/4');
  assert.equal(snap.clock, '1:58.9');
});

test('rest customize plus steps five seconds', () => {
  let t = HybridTimer.create();
  t = HybridTimer.choose(HybridTimer.openPicker(t), 'rest');
  t = HybridTimer.nudgeRest(t, 1);
  assert.equal(HybridTimer.snapshot(t, 0).config.restMs, 65000);
});
