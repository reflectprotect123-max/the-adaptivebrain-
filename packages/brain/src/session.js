import { RULE_VERSION } from './types.js';
import { decideNextStrength } from './strength.js';
import { decideNextEngine } from './engine.js';
import { confirmAnchor } from './anchors.js';

export function open(facts) {
  if (facts.kind === 'engine') {
    const anchor = facts.anchor;
    if (
      anchor &&
      (anchor.confidence === 'confirmed' || anchor.confidence === 'provisional') &&
      anchor.canonicalOutput != null
    ) {
      return {
        target: anchor.canonicalOutput,
        unit: anchor.canonicalUnit,
        confidence: anchor.confidence,
        needsFirstNumber: false,
        ruleVersion: RULE_VERSION,
      };
    }
    return {
      target: null,
      needsFirstNumber: true,
      ruleVersion: RULE_VERSION,
    };
  }

  if (facts.kind === 'strength') {
    if (typeof facts.lastKg === 'number') {
      return {
        targetKg: facts.lastKg,
        needsFirstNumber: false,
        ruleVersion: RULE_VERSION,
      };
    }
    return {
      targetKg: null,
      needsFirstNumber: true,
      ruleVersion: RULE_VERSION,
    };
  }

  return { ruleVersion: RULE_VERSION };
}

export function decideNext(facts) {
  if (facts.kind === 'strength') {
    return decideNextStrength(facts);
  }
  if (facts.kind === 'engine') {
    return decideNextEngine(facts);
  }
  return { hold: true, ruleVersion: RULE_VERSION };
}

export function close(facts) {
  if (facts.kind === 'engine') {
    return {
      ...confirmAnchor({ unit: facts.unit, observations: facts.observations }),
      ruleVersion: RULE_VERSION,
    };
  }
  if (facts.kind === 'strength') {
    return {
      lastKg: facts.actualKg ?? null,
      ruleVersion: RULE_VERSION,
    };
  }
  return { ruleVersion: RULE_VERSION };
}
