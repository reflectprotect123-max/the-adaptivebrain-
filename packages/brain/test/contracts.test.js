import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const rules = JSON.parse(readFileSync(join(root, 'docs/contracts/00-RULE-CONFIG.json'), 'utf8'));
const vectors = JSON.parse(readFileSync(join(root, 'docs/contracts/00-TEST-VECTORS.json'), 'utf8'));

test('strength feedback is load, reps, effort — not rir', () => {
  assert.deepEqual(rules.shared.strength_feedback, ['load', 'completed_reps', 'effort']);
  assert.equal(rules.shared.required_pain_prompt, false);
});

test('athlete zone math is live, not shadow', () => {
  assert.equal(rules.daily_zones.shadow_mode_required, false);
});

test('strength vectors exist', () => {
  assert.ok(Array.isArray(vectors.strength) && vectors.strength.length >= 5);
});
