import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const dir = dirname(fileURLToPath(import.meta.url));

require(join(dir, 'brain-kernel.js'));
require(join(dir, 'adaptive-bundle.js'));
require(join(dir, 'engine.js'));
const Eng = globalThis.HybridEngine;
const Ad = globalThis.HybridAdaptive;
const Kernel = globalThis.HybridBrainKernel;

test('effort chips map to talk-test bands, not a typed 7-8 box', () => {
  assert.deepEqual(Eng.bandFor('easy'), { min: 3, max: 4 });
  assert.deepEqual(Eng.bandFor('medium'), { min: 5, max: 7 });
  assert.deepEqual(Eng.bandFor('hard'), { min: 8, max: 9.5 });
});

test('machine picks modality: bike watts, row split, fan rpm, walk none', () => {
  assert.equal(Eng.modalityFor('bike'), 'watts');
  assert.equal(Eng.modalityFor('echo'), 'watts');
  assert.equal(Eng.modalityFor('row'), 'split');
  assert.equal(Eng.modalityFor('ski'), 'split');
  assert.equal(Eng.modalityFor('fan'), 'rpm');
  assert.equal(Eng.modalityFor('walk'), 'none');
  assert.equal(Eng.modalityFor('run'), 'none');
});

test('open bike uses typed watts; walk invents no pace', () => {
  const bike = Eng.openPiece({
    machine: 'bike',
    effort: 'hard',
    typedWatts: 220,
  }, null, Ad);
  assert.equal(bike.ok, true);
  assert.equal(bike.target.watts, 220);
  assert.equal(bike.modality, 'watts');

  const walk = Eng.openPiece({ machine: 'walk', effort: 'easy' }, null, Ad);
  assert.equal(walk.ok, true);
  assert.equal(walk.skipped, true);
  assert.equal(walk.target.watts, null);
});

test('open writes last Close even if a leftover typed number exists', () => {
  const opened = Eng.openPiece({
    machine: 'bike',
    effort: 'medium',
    typedWatts: 180,
  }, { watts: 210 }, Ad);
  assert.equal(opened.target.watts, 180);
  const fromClose = Eng.openPiece({
    machine: 'bike',
    effort: 'medium',
  }, { watts: 210 }, Ad);
  assert.equal(fromClose.target.watts, 210);
});

test('endWork goes to rest with needsEffort, not rate', () => {
  let log = Eng.readyLog({
    machine: 'bike',
    structure: 'intervals',
    effort: 'hard',
    workSec: 15,
    restSec: 45,
    rounds: 8,
    typedWatts: 220,
  }, Ad);
  log = Eng.startWork(log, 1_000);
  log = Eng.endWork(log, 16_000);
  assert.equal(log.engine.phase, 'rest');
  assert.equal(log.engine.needsEffort, true);
  assert.notEqual(log.engine.phase, 'rate');
});

test('recordEffort applies EMH watt table; rest seconds stay on the card', () => {
  let log = Eng.readyLog({
    machine: 'bike',
    structure: 'intervals',
    effort: 'hard',
    workSec: 15,
    restSec: 45,
    rounds: 8,
    typedWatts: 220,
  }, Ad);
  assert.equal(log.engine.target.watts, 220);
  assert.equal(log.engine.restSec, 45);
  log = Eng.startWork(log, 1_000);
  log = Eng.endWork(log, 16_000);
  assert.equal(log.engine.needsEffort, true);
  log = Eng.recordEffort(log, 'easy', Ad, 16_000);
  assert.equal(log.engine.target.watts, 231);
  assert.equal(log.engine.restSec, 45);
  assert.equal(log.engine.needsEffort, false);
  assert.equal(log.engine.phase, 'rest');
  assert.equal(log.engine.roundIndex, 1);
  assert.equal(log.engine.rounds, 8);
});

test('hard reported on medium cuts watts via decideNextEngine', () => {
  let log = Eng.readyLog({
    machine: 'bike',
    structure: 'intervals',
    effort: 'medium',
    workSec: 15,
    restSec: 45,
    rounds: 4,
    typedWatts: 220,
  }, Ad);
  log = Eng.startWork(log, 0);
  log = Eng.endWork(log, 15_000);
  log = Eng.recordEffort(log, 'hard', Ad, 15_000);
  assert.equal(log.engine.target.watts, 213);
  assert.equal(log.engine.restSec, 45);
});

test('row split Next is seconds not watts; rest clock unchanged', () => {
  let log = Eng.readyLog({
    machine: 'row',
    structure: 'intervals',
    effort: 'hard',
    workSec: 15,
    restSec: 45,
    rounds: 3,
    typedSplitSec: 120,
  }, Ad);
  log = Eng.startWork(log, 0);
  log = Eng.endWork(log, 15_000);
  log = Eng.recordEffort(log, 'medium', Ad, 15_000);
  assert.equal(log.engine.target.splitSec, 119);
  assert.equal(log.engine.target.watts, null);
  assert.equal(log.engine.restSec, 45);
});

test('incomplete work cannot increase output', () => {
  let log = Eng.readyLog({
    machine: 'bike',
    structure: 'intervals',
    effort: 'medium',
    workSec: 15,
    restSec: 45,
    rounds: 4,
    typedWatts: 200,
  }, Ad);
  log = Eng.startWork(log, 0);
  log = Eng.endWork(log, 10_000, true);
  log = Eng.recordEffort(log, 'easy', Ad, 10_000);
  assert.equal(log.engine.target.watts, 200);
});

test('tempo and steady recordEffort once then close; Close is last made work', () => {
  let log = Eng.readyLog({
    machine: 'bike',
    structure: 'steady',
    effort: 'medium',
    workSec: 480,
    restSec: 0,
    rounds: 1,
    typedWatts: 180,
  }, Ad);
  log = Eng.startWork(log, 0);
  log = Eng.endWork(log, 480_000);
  log = Eng.recordEffort(log, 'medium', Ad, 480_000);
  assert.equal(log.engine.phase, 'done');
  const closed = Eng.closePiece(log, Ad);
  assert.equal(closed.ok, true);
  assert.equal(closed.watts, 180);
});

test('low WHOOP recovery does not rewrite last Close output', () => {
  const fromClose = Eng.openPiece({ machine: 'bike', effort: 'medium' }, { watts: 200 }, Ad, 20);
  assert.equal(fromClose.target.watts, 200);
  const typed = Eng.openPiece({
    machine: 'bike',
    effort: 'medium',
    typedWatts: 200,
  }, { watts: 240 }, Ad, 20);
  assert.equal(typed.target.watts, 200);
  const high = Eng.openPiece({ machine: 'bike', effort: 'medium' }, { watts: 200 }, Ad, 80);
  assert.equal(high.target.watts, 200);
});

test('fan rpm Next is rpm not watts; skip rest starts the next work clock', () => {
  let log = Eng.readyLog({
    machine: 'fan',
    structure: 'intervals',
    effort: 'hard',
    workSec: 20,
    restSec: 10,
    rounds: 3,
    typedRpm: 80,
  }, Ad);
  log = Eng.startWork(log, 0);
  log = Eng.endWork(log, 20_000);
  log = Eng.recordEffort(log, 'medium', Ad, 20_000);
  assert.equal(log.engine.target.rpm, 81);
  assert.equal(log.engine.target.watts, null);
  assert.equal(log.engine.phase, 'rest');
  log = Eng.skipRestAndStart(log, 25_000);
  assert.equal(log.engine.phase, 'work');
  assert.equal(log.engine.workEndsAt, 45_000);
  assert.equal(log.engine.restEndsAt, null);
});

test('rateWork removed; recordEffort uses brain kernel', () => {
  assert.equal(Eng.rateWork, undefined);
  assert.equal(typeof Eng.recordEffort, 'function');
  const out = Kernel.decideNextEngine({
    machine: 'concept2',
    intendedEffort: 'medium',
    reportedEffort: 'easy',
    actualOutput: 230,
    complete: true,
    unit: 'watts',
  });
  assert.equal(out.nextOutput, 237);
});

test('open without history does not invent watts', () => {
  const opened = Eng.openPiece({ machine: 'bike', effort: 'medium' }, null, Ad);
  assert.equal(opened.skipped, true);
  assert.equal(opened.target.watts, null);
});

test('closePiece confirms two agreeing watt bouts via kernel', () => {
  let log = Eng.readyLog({
    machine: 'bike',
    structure: 'intervals',
    effort: 'medium',
    workSec: 15,
    restSec: 45,
    rounds: 2,
    typedWatts: 200,
  }, Ad);
  log = Eng.startWork(log, 0);
  log = Eng.endWork(log, 15_000);
  log = Eng.recordEffort(log, 'medium', Ad, 15_000);
  log = Eng.skipRestAndStart(log, 16_000);
  log = Eng.endWork(log, 31_000);
  log = Eng.recordEffort(log, 'medium', Ad, 31_000);
  const closed = Eng.closePiece(log, Ad);
  assert.equal(closed.confidence, 'confirmed');
  assert.equal(closed.canonicalOutput, 200);
  assert.equal(closed.canonicalUnit, 'watts');
  assert.ok(closed.ruleVersion);
});

test('prescription copy is splits/watts/rpm, never a strength set grid', () => {
  assert.match(Eng.rxText({
    machine: 'row',
    structure: 'intervals',
    workSec: 15,
    restSec: 45,
    rounds: 8,
    effort: 'hard',
    typedSplitSec: 136,
  }), /8/);
  assert.match(Eng.rxText({
    machine: 'row',
    structure: 'intervals',
    workSec: 15,
    restSec: 45,
    rounds: 8,
    effort: 'hard',
    typedSplitSec: 136,
  }), /2:16/);
  assert.doesNotMatch(Eng.rxText({
    machine: 'bike',
    structure: 'intervals',
    workSec: 15,
    restSec: 45,
    rounds: 8,
    effort: 'hard',
    typedWatts: 220,
  }), /\bkg\b/i);
});
