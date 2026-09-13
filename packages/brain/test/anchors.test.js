import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { confirmAnchor } from '../src/anchors.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const rows = JSON.parse(readFileSync(join(root, 'docs/contracts/00-TEST-VECTORS.json'), 'utf8')).conditioning.anchor;

test('anchor vectors', () => {
  for (const row of rows) {
    const out = confirmAnchor({ unit: row.unit, observations: row.observations });
    assert.equal(out.confidence, row.expected_confidence);
    if (row.expected_anchor != null) assert.equal(out.anchor, row.expected_anchor);
  }
});
