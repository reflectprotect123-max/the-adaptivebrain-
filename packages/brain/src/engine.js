import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULE_VERSION, EFFORTS } from './types.js';

const rules = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../docs/contracts/00-RULE-CONFIG.json'), 'utf8'),
);

export function decideNextEngine(input) {
  const actual = input.actualOutput;
  if (actual == null || !EFFORTS.includes(input.reportedEffort)) {
    return { nextOutput: actual ?? null, unit: input.unit, ruleVersion: RULE_VERSION, hold: true };
  }

  const intended = input.intendedEffort;
  const reported = input.reportedEffort;

  if (input.machine === 'echo') {
    const delta = rules.conditioning.echo_bike_rpm_multipliers[intended][reported];
    if (!input.complete && delta > 0) {
      return { nextOutput: actual, unit: 'rpm', ruleVersion: RULE_VERSION, hold: true };
    }
    return { nextOutput: actual + delta, unit: 'rpm', ruleVersion: RULE_VERSION, hold: delta === 0 };
  }

  const factor = rules.conditioning.concept2_power_multipliers[intended][reported];
  if (!input.complete && factor > 1) {
    return { nextOutput: actual, unit: 'watts', ruleVersion: RULE_VERSION, hold: true };
  }
  return {
    nextOutput: Math.round(actual * factor),
    unit: 'watts',
    ruleVersion: RULE_VERSION,
    hold: factor === 1,
  };
}
