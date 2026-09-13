import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { dailyZones } from '../src/zones.js';
import { RULE_VERSION } from '../src/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const v = JSON.parse(readFileSync(join(root, 'docs/contracts/00-TEST-VECTORS.json'), 'utf8'));

const profile = v.daily_zones.profile;
const baseInput = {
  hrMax: profile.hr_max,
  rhr28: profile.rhr_28_median,
  bgBase: profile.bg_base,
  grBase: profile.gr_base,
  freshness: 'current',
};

test('daily zones vectors', () => {
  for (const row of v.daily_zones.cases) {
    const out = dailyZones({ ...baseInput, recovery: row.recovery });
    assert.ok(Math.abs(out.bgToday - row.bg_today) <= 0.05, `bgToday recovery=${row.recovery}`);
    assert.ok(Math.abs(out.grToday - row.gr_today) <= 0.05, `grToday recovery=${row.recovery}`);
    if (row.shift_hrr_points != null) {
      assert.ok(Math.abs(out.shiftHrrPoints - row.shift_hrr_points) <= 0.01);
    }
    assert.equal(out.ruleVersion, RULE_VERSION);
  }
});

test('missing freshness returns baseline', () => {
  const out = dailyZones({ ...baseInput, recovery: 50, freshness: 'missing' });
  assert.equal(out.bgToday, profile.bg_base);
  assert.equal(out.grToday, profile.gr_base);
  assert.equal(out.shiftHrrPoints, 0);
  assert.equal(out.moduleCeiling, 'planned');
  assert.equal(out.freshness, 'missing');
  assert.equal(out.ruleVersion, RULE_VERSION);
});
