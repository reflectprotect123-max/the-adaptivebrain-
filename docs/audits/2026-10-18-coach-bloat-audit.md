# Coach bloat audit — 18 October 2026

Audited source: `158f654a898ba9f10d16c0f19c6353f704c9628e` in `the-adaptivebrain-`.
Inspected published Windows installer 1.0.6, its extracted resources and app.asar,
Coach browser entry points, generated catalogue data, dependencies and release scripts.
This is an audit and a temporary packaging experiment. Production code and live channels
were not changed during the audit. This does not cover the entire Strength APK.

## What matters most

The main product waste is repeated data and work, rather than a large framework stack:

1. Every ordinary edit serializes the full exercise catalogue into application state.
2. An edit can schedule a cloud pass over every published workout, even unchanged ones.
3. The catalogue combines legacy and Supabase records with duplicate names/identities.
4. Release filters ship unused athlete modules and duplicate an HTML document in OTA.
5. Windows includes 55 language packs despite an English-only Coach interface.
6. The repository is dominated by upstream tool snapshots and historic ZIP handoffs.

Do not remove programming metrics, WHOOP, exercise variants, athlete receipts or update
recovery code to address these issues. Their functionality is not demonstrated bloat.

## Measured inventory

| Item | Measurement | Interpretation |
| --- | ---: | --- |
| Readable tracked repository files | 346,662,666 bytes / 330.60 MiB | Excludes Git history, node_modules and build outputs |
| vendor/ | 266,893,926 bytes / 254.53 MiB; 9,658 files | Upstream project snapshots, not Coach runtime |
| .cursor/ | 26,525,422 bytes / 25.30 MiB | Installed tooling; 608 SKILL.md entry points |
| Three root handoff ZIPs | 39,896,832 bytes / 38.05 MiB | Historic source handoffs, not installed runtime |
| Published installer | 82,266,344 bytes / 78.46 MiB | Windows NSIS executable |
| Extracted Windows install | 284,983,536 bytes / 271.78 MiB | Mostly Electron/platform runtime |
| App-specific resources directory | 4,027,887 bytes / 3.84 MiB | Includes app.asar and Coach web assets |
| Staged Capgo web files | 1,452,167 bytes | Before ZIP compression |
| Local JS requested by Coach | 1,155,549 decoded bytes | Offline demo instrumentation; excludes inline HTML JS and external SDK/fonts |
| Two generated catalogue JS files | 944,489 bytes | 81.7% of the requested local JS |

Repository archive/tooling bytes do not inflate the installer or APK. Deleting tracked
files would not erase those files from Git history; no history rewrite is proposed.

## Findings and suggested fixes

### 1. Full catalogue copied into every state save — high practical priority

Evidence:
- `apps/coach/coach-loop.js:1054` merges all catalogue rows into `state.exercises`.
- `apps/coach/coach-loop.js:1421` stringifies the entire state into localStorage.
- `apps/coach/coach.html:435` calls that save from `persist()`.
- Session title, notes and several builder inputs call persist on input.

An offline session-building state contained **465,488 JSON characters**, of which
**425,154 characters (91.3%)** were exercises. A single instrumented persist took
approximately 5 ms in this cloud browser; this is a single observation, not a
production latency benchmark or proof of user-visible lag today.

Keep builtin catalogue data outside mutable application state. Persist custom exercises,
user overrides, a catalogue version and session references. Reconstruct the view on load.
Migrate existing saved states; preserve custom exercise metadata and old IDs. Flush
pending edits on blur/page close if save batching is introduced. Do not trade redundant
writes for lost edits.

### 2. Unchanged published sessions still generate cloud work — high practical priority

Evidence:
- `apps/coach/coach.html:442` schedules pushPublished after an 800 ms edit debounce.
- `apps/coach/coach-cloud.js:175` defaults to all published sessions.
- `apps/coach/coach-cloud.js:125` selects an assignment and updates it even when the
  authored prescription and scheduling fields have not changed.
- `apps/coach/coach-cloud.js:212` saves local state after every successful assignment.

An isolated adapter experiment called the real CoachCloud module twice with the same
20 already-published sessions. It recorded **40 selects, 40 updates and 40 local state
saves**. These were in-memory calls, not production database requests or measured
network latency. Auth/session refresh overhead was not counted.

Track dirty session IDs and compare the relevant persisted payload before writing.
Use the existing sessionIds option for targeted publishes. Keep explicit publish,
unpublish, scheduled-date changes, frozen prescriptions and completed receipts intact.
Save resolved assignment IDs once per batch where practical. Preserve current failed
publish handling and the serialized queue until a replacement is tested.

### 3. Duplicate exercise identities in search — correctness before byte savings

Both generated arrays contain **2,120 records**, with the same set of IDs.
There are **105 pairs of equal normalized display names**. Back Squat search returned
both `core-back-squat` and `exercise_1ac603ef245264c6`, with different categories.

Evidence:
- `scripts/gen-exercise-search-index.mjs:143` concatenates the core, prep and Supabase
  lists without resolving equivalent records across those sources.
- `apps/coach/exercise-search.js:91` ranks all rows; its later de-duplication is by ID.

Build a reviewed canonical ID/alias mapping, retain distinct equipment/variation and
banded records, and preserve existing workout references. A same-name pair is a review
candidate, not proof that the two movements are interchangeable. Do not delete Supabase
rows or rewrite workout history simply by comparing labels.

Coach lift memory currently keys local records by normalized name
(`apps/coach/coach-lifts.js:10`) and also stores exerciseId; migration must account for
both. This audit does not claim that every duplicate label already causes split e1RM.

### 4. Two large catalogue representations — consolidate after identity cleanup

`coach-exercise-catalog.js` repeats IDs/names/categories from `exercise-search-index.js`.
The records have different additional fields: catalogue metadata versus search aliases
and families. Consequently, dropping either file directly breaks real functionality.

Generate one canonical dataset containing both sets of fields, with lightweight search
and builder views. Preserve IDs, alias ranking, prep units/per-side metadata, movement
categories, source information and custom records. Check the generator against its
source JSON, not by hand-editing generated JS. Compact output is secondary: whitespace
already compresses well, so raw byte savings are not equal to download savings.

### 5. Runtime packaging copies an unused athlete module cluster — low-risk first change

`apps/desktop/package.json:33` copies most of apps/coach via extraResources.
`scripts/stage-coach-capgo.mjs:11` copies every top-level .js/.html file.
Neither uses the actual Coach script graph as the release inventory.

The Coach page requests 14 local JS scripts and does not load these 10 packaged files:

| File | Bytes |
| --- | ---: |
| coach-sync.js | 9,690 |
| strength-brain-core.js | 9,927 |
| strength-context.js | 2,458 |
| strength-equipment.js | 5,735 |
| strength-learning.js | 5,806 |
| strength-load.js | 3,768 |
| strength-policy.js | 395 |
| strength-replay.js | 11,108 |
| strength-rts.js | 1,365 |
| strength-targets.js | 4,206 |
| Total | **54,458** |

Browser instrumentation also confirmed the athlete sync global was absent. Several
source smoke tests intentionally read coach-sync.js, so exclude it from release
packaging rather than blindly deleting it from the repository/test contracts.

A temporary candidate removed only these 10 files. Staged bytes fell from 1,452,167 to
1,397,709. With identical Python ZIP deflate level 6 settings, ZIP size fell from
260,719 to **240,773 bytes**, a **19,946-byte** saving. This is a controlled packaging
comparison, not the exact Capgo ZIP or Windows installer size.

Both baseline and candidate browser suites reported **5/5 passing**. Four HTTP journeys
used the candidate server (offline workspace, builder inputs, returned results and
same-tick editor redraw). The fifth file-storage/startup test stages the original source
itself, so it is an independent regression check, not additional coverage of candidate
asset removal. Auth/WHOOP/live publishing and physical Windows were not retested here.

Use a shared release asset inventory for native and Capgo outputs, and validate that
all local references resolve. Keep source fixtures and meaningful contract tests.

### 6. Capgo staging duplicates the full HTML — small, straightforward cleanup

The staging loop copies coach.html, then copies it again as index.html
(`scripts/stage-coach-capgo.mjs:16`). The two staged files are byte-identical:
**112,754 bytes each**. SDK downloads load index.html; the builtin installer loads
coach.html. Static runtime references did not reveal a navigation dependency on the
second OTA document.

Stage one real document for each distribution target: index.html for OTA and coach.html
for the builtin native fallback. Preserve the sandbox health-acknowledgement URL checks.
The 10-file candidate above did not remove this duplicate, so its measured savings do
not include this proposal.

### 7. Windows language packs and source maps — size reduction, not business logic

The extracted installer contains **55 locale packs, 42,207,130 bytes total**.
Keeping en-GB and en-US would retain 976,227 bytes and remove **41,230,903 bytes
(39.32 MiB)** uncompressed, if English-only desktop support is the intended policy.
Configure electron-builder electronLanguages rather than deleting random runtime files.
Verify dialogs, number/date formatting and language fallback on Windows afterwards.
Compressed installer savings have not been measured.

The published app.asar also contains **50 source maps totalling 993,225 bytes**.
Consider excluding .map files from runtime packaging and retaining them as a separate
build/debug artifact. No .d.ts files were found in this installer. These smaller
optimizations do not justify forking the updater dependencies or stripping runtime DLLs.
Keep license notices, ICU data and graphics fallback components.

### 8. Repository archives and duplicated tooling — large developer-facing excess

vendor/, .cursor/ and the three historic ZIPs account for approximately **96.1%** of
tracked readable bytes. Several vendored claude-mem slide PDFs alone are 10–22 MiB each.
This is much more than the skill instructions Coach development needs.

Hashing found 1,785 duplicate-content groups within vendor/ and .cursor/, representing
46,225,312 extra bytes beyond one copy per group. 1,597 groups span both roots;
26,116,001 .cursor/ bytes have identical content somewhere in vendor/. This is evidence
of copied installation/source material, not evidence that installed skills can all be
deleted. README still says 41 skills whereas 608 skill entry points are present.

Keep useful installed skills and source/version/license inventories. Archive the full
upstream snapshots and historic ZIP handoffs in a separate tools/archive repository or
release before removing their working-tree copies. Do not discard previous data exports,
working-max information or historical sources without retaining the archive.

### 9. Full installer builds still trigger for UI/docs/tests — release work to simplify

`.github/workflows/desktop-coach-build.yml:8` watches every Coach/desktop path. A UI edit,
smoke-test update or desktop README edit therefore triggers a Windows installer build,
even though Capgo can carry browser-only changes. This is unnecessary release work,
not application memory bloat.

Separate verification from release: verify on relevant changes; build native releases
when shell/preload/dependencies/version change; promote tested UI bundles through an
explicit Capgo release step once work is finished. Preserve the user's instruction not
to push unfinished work through Capgo automatically. No new publishing automation or
secrets were configured by this audit.

## Keep these

- Both updater dependencies: Capgo delivers browser assets; electron-updater delivers
  native installers. They are not duplicate implementations of the same release job.
- Startup health acknowledgement, checksum checks, interrupted-start recovery and
  last-good/builtin fallback. The pinned SDK's timeout behaviour needs the wrapper.
- Supabase/WHOOP contracts and authentication; cloud code not executed in an offline
  coverage run is not thereby unused.
- Exercise metrics, warm-up/cool-down metadata, variations, banded catalogue separation,
  stored working maxima, e1RM and returned athlete receipts.
- CoachBridge serialization helpers and explicit bridge-file export. The legacy
  same-origin localStorage write on every edit is a candidate to retire separately,
  but the module is also used by cloud serialization and export.
- LogColumns builder/keypad code. It shares a module with athlete rendering helpers;
  an offline scenario exercised 36 of 110 functions. That is a splitting candidate,
  not proof that the remaining functions or metrics should be deleted.

## Recommended order

1. Apply the tested release-only asset exclusions; remove duplicate OTA HTML through
   the shared inventory; verify both native and OTA startup and asset completeness.
2. Review canonical exercise identities and define a backwards-compatible alias map.
3. Separate immutable catalogue data from saved state; test migration/reload/custom data.
4. Target cloud pushes to actual changes; verify publish/unpublish/freeze/results paths
   with an isolated database before any live release.
5. Trim English-only locale packs and optional source maps in a new native release.
6. Archive upstream snapshots/ZIPs; correct tooling inventory and release triggers.

No new abstraction framework, LLM layer or app redesign is needed for these changes.
The measurable functionality improvements are reduced redundant saving/publishing and
clearer exercise identities; unused JS exclusion alone offers only a modest byte saving.

## Reproduction evidence

Local audit artifacts: `/workspace/artifacts/coach-bloat-audit/`.

- repository-sizes.json, static-measurements.json and catalogue.json
- browser-profile.json: Playwright CLI profile of offline session creation/prescription
- cloud-amplification.json: real module with an in-memory query adapter
- baseline-browser-checks.log and candidate-browser-checks.log
- zip-comparison.json and installer-metadata.json

Skills applied: Superpowers process guidance, systematic-debugging,
verification-before-completion and playwright-cli. Installed skill inventory was reviewed
for relevance. Smart-explore MCP tools were unavailable, so explicit source/reference
searches were used. No subagents were used and no design-style skills were applied.
