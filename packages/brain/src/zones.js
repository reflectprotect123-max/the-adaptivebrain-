import { RULE_VERSION } from './types.js';

export function shiftHrrPoints(R) {
  if (R <= 34) return -8 + 3 * (R / 34);
  if (R <= 67) return -5 + 3 * ((R - 34) / 33);
  return -2 + 2 * ((R - 67) / 33);
}

export function dailyZones(input) {
  const { hrMax, rhr28, bgBase, grBase } = input;
  const hrr = hrMax - rhr28;
  if (input.freshness === 'missing' || input.freshness === 'stale' || input.recovery == null) {
    return {
      bgToday: bgBase,
      grToday: grBase,
      shiftHrrPoints: 0,
      moduleCeiling: 'planned',
      freshness: input.freshness || 'missing',
      ruleVersion: RULE_VERSION,
    };
  }
  const S = shiftHrrPoints(input.recovery);
  const shiftBpm = (S / 100) * hrr;
  let moduleCeiling = 'red';
  if (input.recovery < 34) moduleCeiling = 'blue';
  else if (input.recovery < 67) moduleCeiling = 'green';
  return {
    bgToday: bgBase + shiftBpm,
    grToday: grBase + shiftBpm,
    shiftHrrPoints: S,
    moduleCeiling,
    freshness: 'current',
    ruleVersion: RULE_VERSION,
  };
}
