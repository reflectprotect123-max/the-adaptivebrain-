import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const dir = dirname(fileURLToPath(import.meta.url));
require(join(dir, 'plan-sync.js'));

const P = globalThis.PlanSync;

function libState(templates, extra) {
  return {
    library: {
      templates,
      catalog: { exercises: [], circuits: [] },
      assignments: extra && extra.assignments ? extra.assignments : {},
    },
    sessions: extra && extra.sessions ? extra.sessions : {},
    planSync: extra && extra.planSync ? extra.planSync : { acks: { template: {}, session: {} }, snapshotRev: 0 },
  };
}

test('pack stamps rev on new templates and assignments', () => {
  const packed = P.pack(libState([{ id: 'tpl_a', title: 'Upper', blocks: [] }]));
  assert.equal(packed.domain, 'strength_side');
  assert.equal(packed.templates[0]._meta.rev, 1);
  assert.equal(packed.templates[0].title, 'Upper');
});

test('unchanged body does not bump rev', () => {
  const s = libState([{ id: 'tpl_a', title: 'Upper', blocks: [] }]);
  const once = P.pack(s);
  const twice = P.pack({
    ...s,
    library: { ...s.library, templates: once.templates },
    planSync: { lastPlan: once, acks: { template: {}, session: {} }, snapshotRev: 0 },
  });
  assert.equal(once.templates[0]._meta.rev, 1);
  assert.equal(twice.templates[0]._meta.rev, 1);
});

test('merge adopts remote when local is not dirty past ack', () => {
  const local = {
    domain: 'strength_side',
    templates: [{ id: 'tpl_a', title: 'Old', blocks: [], _meta: { rev: 1 } }],
    sessions: [],
    tombstones: [],
  };
  const remote = {
    domain: 'strength_side',
    templates: [{ id: 'tpl_a', title: 'Cloud', blocks: [], _meta: { rev: 2 } }],
    sessions: [],
    tombstones: [],
  };
  const { plan, conflicts } = P.mergePlan(local, remote, { template: { tpl_a: 1 }, session: {} });
  assert.equal(conflicts.length, 0);
  assert.equal(plan.templates[0].title, 'Cloud');
});

test('merge keeps local and flags conflict when both edited past ack', () => {
  const local = {
    domain: 'strength_side',
    templates: [{ id: 'tpl_a', title: 'Phone A', blocks: [], _meta: { rev: 3 } }],
    sessions: [],
    tombstones: [],
  };
  const remote = {
    domain: 'strength_side',
    templates: [{ id: 'tpl_a', title: 'Phone B', blocks: [], _meta: { rev: 3 } }],
    sessions: [],
    tombstones: [],
  };
  const { plan, conflicts } = P.mergePlan(local, remote, { template: { tpl_a: 1 }, session: {} });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].id, 'tpl_a');
  assert.equal(plan.templates[0].title, 'Phone A');
});

test('tombstone drops the entity', () => {
  const local = {
    domain: 'strength_side',
    templates: [{ id: 'tpl_a', title: 'Gone', blocks: [], _meta: { rev: 1 } }],
    sessions: [],
    tombstones: [],
  };
  const remote = {
    domain: 'strength_side',
    templates: [],
    sessions: [],
    tombstones: [{ id: 'tpl_a', kind: 'template', rev: 2 }],
  };
  const { plan } = P.mergePlan(local, remote, { template: {}, session: {} });
  assert.equal(plan.templates.length, 0);
  assert.ok(plan.tombstones.some((t) => t.id === 'tpl_a'));
});

test('stale snapshot revision is a conflict from the transport', async () => {
  const cloud = { revision: 4, snapshot: { domain: 'strength_side', templates: [], sessions: [], tombstones: [] } };
  const io = {
    async userId() { return 'user-1'; },
    async pull() { return { revision: cloud.revision, snapshot: cloud.snapshot }; },
    async push(rev) {
      if (rev <= cloud.revision) return { wrote: false, revision: cloud.revision };
      cloud.revision = rev;
      return { wrote: true, revision: rev };
    },
  };
  const result = await P.pushWithIo(P.pack(libState([])), 4, io);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'STALE_REV');
});
