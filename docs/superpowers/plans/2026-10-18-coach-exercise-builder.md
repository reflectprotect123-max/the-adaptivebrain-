# Coach exercise step Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Each phase is self-contained. Read the cited lines before editing.

**Goal:** Make the live coach lift step match the decisions already made: no circuits, the six-metric menu, a closed tempo card, and simple edits of a superset or triset.

**Already in the builder (18 Oct 2026):** Next on the session page opens the first main-lift group. Back from cool-down opens the last group. `repsStepHtml` draws one `− Superset` line per group. The picker shows tap order as `lib-pick-order`. `moveMainLift` swaps two main-lift slots and leaves warm-up and cool-down slots where they are, then `settleGroups` clears a `groupId` whose run length is 1. `moveLift` on the reps page sets `liftIndex` to the group that now contains that lift. A `weight_kg` or `weight_lb` cell is a `lib-athlete` label, “Athlete” or “Set 1 weight” on an AMRAP row. It has no input and does not write `demoStartingKg`.

**Architecture:** Behavior stays in `apps/coach/builder/library.js` and `apps/coach/builder/library-ui.js`. Grouping stays `groupId` plus the existing `linkSuperset`, `unlinkSuperset`, `moveBlock`, and `lettered`. Tempo stays `tempoText` plus the existing save path. Metric ids stay in `apps/coach/training-core.js`. The lift menu is a short list in `library-ui.js`. `apps/coach/prototypes/exercise-concept.html` is a picture of the open card. It is not the editor.

**Tech stack:** Vanilla IIFE on `CoachBuilderHost` / `globalThis`. Tests are `node --test apps/coach/builder/library-ui.test.mjs`, also run by `pnpm run check:coach`.

**Authority:** `HANDOFF.md` rulings “Coach exercise metrics” and “Coach exercise step”. V1 spec wins for the athlete logger: first working weight is athlete-supplied, and RPE stays off the track menu (`docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md` lines 66–84).

## Global constraints

- Leave the warm-up screen and the cool-down screen alone. Cool-down already offers only Reps and Seconds (`prepTrackOptions` in `library-ui.js`).
- Do not edit `packages/brain`, `apps/strength`, or `apps/engine`.
- Do not add a starting-weight field. `canonicalBlock` and `patchBlock` already delete `demoStartingKg` (`library.js` lines 47–50 and 234). Weight cells on a lift card stay empty. An AMRAP weight cell stays “Set 1 weight”.
- There is no circuit in this builder. No Circuits tab, no Add Circuit, no New Circuit, no For Completion block to add.
- Do not delete metric ids from `training-core.js`. `for_completion` may remain in that file. The coach cannot pick it.
- Do not re-litigate Easy/Medium/Hard, the 1–5 feel screen, or shadow mode.
- The superset divider text stays `− Superset` for two lifts and for three or more.
- Tap order is group order. `togglePick` stores ids in a `Set`, which keeps insertion order (`library-ui.js` `togglePick`).

---

## Phase 0: Allowed APIs

Discovery is done. Copy these. Do not invent a second grouping model.

| API | Signature | Where |
| --- | --- | --- |
| `linkSuperset` | `linkSuperset(state, tid, aId, bId)` — both must be `kind === 'lift'`. Shared `groupId` is `a.groupId \|\| b.groupId \|\| nid('ss')`. | `apps/coach/builder/library.js` lines 272–282 |
| `unlinkSuperset` | `unlinkSuperset(state, tid, bid)` — sets that block’s `groupId` to `null`. Exported. No UI caller yet. | `library.js` lines 285–291 |
| `moveBlock` | `moveBlock(state, tid, bid, dir)` — `dir < 0` swaps with the previous array neighbor. `dir > 0` swaps with the next. | `library.js` lines 214–224 |
| `lettered` | `lettered(tpl)` — non-mutating. Warm-up, then main lifts, then cool-down. A consecutive same-`groupId` run of one lift gets a plain letter. A longer run gets `B1`, `B2`, `B3`. | `library.js` lines 294–319 |
| `removeBlock` | `removeBlock(state, tid, bid)` | `library.js` lines 206–211 |
| `addExercise` | `addExercise(state, tid, { catalogId })` — pushes a lift with `groupId: null` onto the end of `blocks`. | `library.js` lines 164–203 |
| `liftGroups` | Local. Walks lettered main lifts. One array per consecutive `groupId` run. | `library-ui.js` lines 501–512 |
| `addPicked` | `LibraryView.addPicked(asSuperset)` — adds `ui.selected` in order. `true` chains `linkSuperset` on the new ids. The `circuits` branch in this function is removed in Phase 1. | `library-ui.js` lines 708–724 |
| `tempoText` | `tempoText(value)` — four characters, digits, and `X`. Otherwise `''`. | `library.js` lines 267–270 |
| `tempoControl` / `beginTempo` / `draftTempo` / `saveTempo` | Closed menu today. Empty face says “No tempo”. “Add tempo” is inside the hidden menu. Four boxes: Lower / way down, Pause / bottom, Lift / X means fast, Pause / top. `X` is valid only in the Lift box. Storage key `strength-training-tempos`. | `library-ui.js` lines 152–166 and 807–849 |
| `LIFT_METRICS` + `liftTrackOptions` | Short list plus every other `TrainingCore.definitions` entry (`watts`, `lwp`, and the rest). | `library-ui.js` lines 111–125 |
| `trackOptions` | New-exercise sheet. Every `TRACK` key except `for_completion`, plus None. | `library-ui.js` lines 101–108 |
| `normalize` | Set targets use `loadRule: { kind: 'adaptive' }`. AMRAP may use `first_working_set`. | `apps/coach/builder/strength-targets.js` |

`session.open` for strength returns `targetKg: lastKg` when memory exists, otherwise `targetKg: null` and `needsFirstNumber: true` (`packages/brain/src/session.js` lines 29–41). Coach does not call it. Leave that path alone.

### Anti-patterns from discovery

- `reorder()` (`library-ui.js` lines 971–989) asks for `3-1` through `window.prompt`. The numbers are raw `blocks` indexes, which include warm-up and cool-down. Remove this path in Phase 3.
- `unlinkSuperset` is exported and unused. Call it. Do not write a new ungroup function.
- Setting `groupId` on a lift that is not next to the rest of the run does nothing visible. `lettered` only joins a consecutive run. After `addExercise`, bubble the new lift with `moveBlock` until it sits immediately after the run.
- `docs/handoff-misc/09-product-design/product-and-technical-design.md` still lists RPE in an old coach table. That file loses to `HANDOFF.md`.
- Warm-up and cool-down screens are titled Warm-up and Cool-down. `prepCircuitHtml` is only the function name. Leave those screens alone. `placeTextBlock` may still store a text block as `kind: 'circuit'`. That storage is not a circuit the coach picks.

---

## Phase 1: Remove circuits

**What to implement**

The exercise picker is exercises only. Copy the exercise branch of `pickerHtml` and delete the circuit branch.

Remove these controls:

- The picker tab `Circuits` and `LibraryView.picker('circuits')` (`library-ui.js` around lines 349–369).
- `+ Add Circuit` in `editorHtml` (line 252).
- `Create New Circuit`, `newCirc`, `saveNewCirc`, and the New Circuit sheet (`createSheetHtml` around line 425).
- The search placeholder “Search exercises and circuits”. The placeholder is “Search exercises”.
- `+ Add Circuit` in `apps/coach/prototypes/exercise-concept.html` (the button near line 292).

The library chrome in `apps/coach/coach.html` `libraryTabs` (line 728) still draws a disabled Circuits tab. Remove that tab. `apps/coach/coach-clone.smoke.mjs` line 28 asserts the source contains `Circuits`. Change that assertion so the file passes with the tab gone.

`addCircuit`, `createCatalogCircuit`, and `SEED_CIRCUITS` can stay in `library.js` so an imported template still loads. No button calls them.

**Documentation references**

- `HANDOFF.md` “Coach exercise step” — there is no Circuits tab
- `library-ui.js` `pickerHtml` lines 345–376, `editorHtml` line 252, `addPicked` lines 708–724
- `library.js` `SEED_CIRCUITS` lines 19–24 and `addCircuit` lines 141–162
- `coach.html` `libraryTabs` lines 727–732
- Test `new exercise and circuit forms render without editor-only block references` in `library-ui.test.mjs` lines 134–137

**Verification**

- [ ] Picker HTML has no `Circuits`, `New Circuit`, or `Add Circuit`.
- [ ] `newEx` still renders New Exercise.
- [ ] The test that called `newCirc` no longer expects New Circuit.
- [ ] `coach-clone.smoke.mjs` no longer requires the word `Circuits`.
- [ ] Warm-up still lists Bike. Cool-down still offers only Reps and Seconds.
- [ ] `node --test apps/coach/builder/library-ui.test.mjs` passes.

**Anti-pattern guards**

- Do not redesign the warm-up or cool-down screens.
- Do not delete `placeTextBlock`.
- Do not remove `for_completion` from `training-core.js`.

---

## Phase 2: Lift metric menu

**What to implement**

Copy the six HANDOFF ids into the lift menu. Stop appending the rest of `TrainingCore.definitions`.

The menu is exactly:

| id | label |
| --- | --- |
| `reps` | Reps |
| `reps_range` | Rep Range |
| `weight_kg` | Weight (kg) |
| `weight_pct` | Weight (%) |
| `seconds` | Seconds |
| `meters` | Meters |

The first select has no None. The second select starts with `none` / None, then the same six. Use `liftTrackOptions(selected, allowNone)` for both lift-card selects (`exerciseCardHtml`, lines 305–309).

Point the new-exercise sheet at that same function. `saveNewEx` reads `#libNewC1` and `#libNewC2` (`library-ui.js` `saveNewEx`). Replace the `trackOptions(...)` calls in the New Exercise sheet with `liftTrackOptions`. Phase 1 removed the circuit sheet.

**Documentation references**

- `HANDOFF.md` “Coach exercise metrics”
- `library-ui.js` lines 101–125, 305–309, and the new-exercise markup in `createSheetHtml`
- `training-core.js` lines 5–14 for the id strings
- Test to change: `the lift card uses the tempo dropdown and Next leaves for cool-down` in `library-ui.test.mjs` (it asserts `/Watts/`)

**Verification**

- [ ] `LIFT_METRICS` is the six rows above.
- [ ] `liftTrackOptions` does not read `TrainingCore.definitions`.
- [ ] The Watts test now asserts the six labels, and asserts the card HTML does not match `Watts`, `Weight (lb)`, `Miles`, `Yards`, `Feet`, or `mm:ss`.
- [ ] Cool-down tests stay as they are: `cool-down is a circuit and only offers seconds and reps`, `cool-down add list stores the locked start and the track select is reps or seconds`, `cool-down track change keeps the start number on seconds or reps`.
- [ ] `node --test apps/coach/builder/library-ui.test.mjs` passes.

**Anti-pattern guards**

- Do not remove ids from `training-core.js`.
- Do not change `prepTrackOptions` or `COOLDOWN_CATALOG`.
- Do not put `for_completion` on a lift.

---

## Phase 3: Closed tempo card

**What to implement**

Replace the hidden chip menu in `tempoControl` with a closed card. Copy the four-box markup that already lives in `tempoControl` (Lower / way down, Pause / bottom, Lift / X means fast, Pause / top) and the `saveTempo` / `tempoText` checks.

Card faces:

| State | What the coach sees |
| --- | --- |
| No saved tempo, boxes closed | The words “No tempo” and a button labeled `Add`. The four boxes are absent. |
| `Add` clicked, or `beginTempo(bid)` called | The four boxes and Save. |
| Tempo saved, boxes closed | The four-character tempo (`31X1`) on the card. Activating it calls `beginTempo` and opens the four boxes filled from that tempo. |

Keep `beginTempo`, `draftTempo`, `saveTempo`, and `strength-training-tempos`. `X` stays valid only in the Lift box. Warm-up blocks still have no tempo control (test `wizard edit shows Next on the lift cards and keeps tempo off warm-up blocks`).

**Documentation references**

- `HANDOFF.md` “Coach exercise step” tempo sentence
- `library-ui.js` `tempoControl` lines 152–166 and tempo methods around 807–849
- `library.js` `tempoText` lines 267–270
- Picture of the open boxes: `apps/coach/prototypes/exercise-concept.html` (the `.tempo-grid` block). Copy the four labels from `tempoControl`, which the tests already match. The prototype also draws saved chips and an already-open grid. The closed card above is the rule.
- Tests: `creating a session walks warm-up, the exercise picker, reps, tempo, cool-down, then the session` and `tempo accepts X only in the Lift phase so saved prescriptions match the brain context`

**Verification**

- [ ] Before `beginTempo`, lift HTML matches `/No tempo/` and a button `Add`, and does not match `/way down/`.
- [ ] After `beginTempo`, HTML matches Lower, way down, bottom, Lift, X means fast, and top.
- [ ] Saving `3`,`1`,`x`,`0` still stores `31X0` and writes `strength-training-tempos`.
- [ ] An invalid Lift character still refuses the save (`tempo accepts X only…`).
- [ ] Warm-up Bike HTML still has no “No tempo”.
- [ ] `node --test apps/coach/builder/library-ui.test.mjs` passes.

**Anti-pattern guards**

- Do not add a kilogram box to this card.
- Do not show the four boxes on the closed face.
- Do not put tempo controls on warm-up or cool-down blocks.

---

## Phase 4: Delete, Up, Down, Ungroup, Add to group

**What to implement**

A group is a consecutive run of main lifts (`kind === 'lift'` and no `role`) that share `groupId`. `lettered` already letters that run `B1` `B2` `B3` and draws `− Superset` between members (`editorHtml` lines 212–216, `chosenBlocksHtml` lines 382–386). Keep that.

Picker behavior stays, including the tap-order numbers already on each selected row. `Add` (`addPicked(false)`) gives each pick its own letter. `Superset` (`addPicked(true)`, enabled at 2 or more) links those picks in tap order into one new group. Three picks are the triset. One `− Superset` line is drawn for the whole run, including on the reps step. `wizardNext` from the session page opens the first group. Back from cool-down opens the last group.

Replace `reorder()` and the `Reorder` button.

Add these controls on each main lift card (`exerciseCardHtml`), in the editor and on the reps step:

| Control | Behavior |
| --- | --- |
| Delete | Existing `LibraryView.removeBlock`. Then settle the group (below). |
| Up | Move this lift one place earlier among main lifts. |
| Down | Move this lift one place later among main lifts. |
| Ungroup | Shown when this lift shares `groupId` with a neighbor. Calls `unlinkSuperset`, then settle. |

**Move among main lifts.** This is already `moveMainLift` in `library.js`. It collects the array slots of main lifts, swaps the chosen lift with the previous or next main lift inside those slots, and leaves every warm-up and cool-down block in its slot. Do not bubble with `moveBlock` until an index of `previous - 1`. That stop condition is impossible when the previous lift is already first.

**Leaving a group.** After Delete, Up, or Down, settle:

1. Walk main lifts in array order.
2. A run is the consecutive lifts with the same non-null `groupId`.
3. A lift whose `groupId` is set and whose run length is 1 gets `unlinkSuperset`.

That is the whole rule. Up or Down inside `B1 B2 B3` swaps order and the three stay one group. Up or Down past the edge unlinks the lift that left. The others stay a group. One leftover is unlinked and `lettered` shows a plain letter.

**Add to group.** On a run whose length is at least 2, show one button, `Add to group`, on the reps step and in the editor. It stores `libUi.joinGroupId` and opens the existing exercise picker (`LibraryView.picker('exercises')`).

While `joinGroupId` is set, the picker shows one confirm button, `Add to group`, enabled when at least one exercise is selected. It does not use the Superset button for this path.

The confirm handler copies `addPicked`’s add loop, then:

1. Let `anchor` be the last main lift that already has `joinGroupId`.
2. `linkSuperset(state, tid, anchor, added[0])`.
3. Chain `linkSuperset` from `added[i - 1]` to `added[i]` for the rest, in tap order.
4. Bubble each new id with `moveBlock` until the new lifts sit, in tap order, immediately after `anchor` and before any later main lift.
5. Clear `joinGroupId` and return to the screen that opened the picker.

`linkSuperset` reuses the anchor’s `groupId`. The bubble is required because `addExercise` pushes onto the end, and `lettered` will not join a run with another lift between the parts.

**Documentation references**

- `HANDOFF.md` “Coach exercise step”
- `library.js` `moveBlock`, `linkSuperset`, `unlinkSuperset`, `lettered`, `removeBlock`, `addExercise` (lines cited in Phase 0)
- `library-ui.js` `addPicked` lines 708–724, `exerciseCardHtml` lines 272–325, `reorder` lines 971–989
- Existing walk: test `creating a session walks warm-up, the exercise picker, reps, tempo, cool-down, then the session` (Back Squat via `addPicked(false)`, then Bench Press + Lat Pull Downs via `addPicked(true)`; Next shows the squat, then both names)

**Verification**

Add tests in `library-ui.test.mjs` that build the template through `LibraryView` or `HybridLibrary` and read `groupId` plus `lettered`:

- [ ] Add three exercises with `addPicked(true)`. Letters are `A1`, `A2`, `A3`. HTML contains `− Superset`.
- [ ] Delete the middle one. The other two share one `groupId` and letter as `A1` and `A2`.
- [ ] Delete until one remains. That lift’s `groupId` is `null` and its letter has no digit.
- [ ] Up on `A2` makes it `A1`. All three still share `groupId`.
- [ ] Up on `A1` when another lift sits above the group unlinks only `A1`. The other two stay linked.
- [ ] Down on the last member, with a lift below the group, unlinks only that member.
- [ ] Ungroup on one member of three unlinks that member. The other two stay linked. Ungroup on one member of two leaves both with `groupId` `null`.
- [ ] `Add to group` on `A` appends the new lift as `A3` (or the next suffix) immediately after the run. A later solo lift keeps its own letter.
- [ ] The editor HTML has no `Reorder` button and `library-ui.js` has no `window.prompt`.
- [ ] The existing wizard walk still shows Back Squat alone, then Bench Press and Lat Pull Downs together.
- [ ] `node --test apps/coach/builder/library-ui.test.mjs` passes.

**Anti-pattern guards**

- Do not add a Triset button. Three selections plus Superset is the triset.
- Do not change the divider string.
- Do not call `unlinkSuperset` on a lift that still has a consecutive partner.
- Do not use `window.prompt` or raw `3-1` indexes.
- Join mode stays on the exercise picker. There is no circuits tab.

---

## Phase 5: Verification

- [ ] Re-read `HANDOFF.md` “Coach exercise metrics” and “Coach exercise step” and confirm the diff does only those things.
- [ ] Grep `apps/coach/builder/library-ui.js` for `window.prompt`, `weight_lb`, `time_mmss`, `Watts`, `Reorder`, `Add Circuit`, and `Circuits`. The lift menu, the reorder prompt, and the circuit controls are gone. `training-core.js` may still contain those metric ids.
- [ ] Grep `apps/coach` for `demoStartingKg`. The only hits are the deletes in `canonicalBlock` and `patchBlock`.
- [ ] `node --test apps/coach/builder/library-ui.test.mjs` passes.
- [ ] `pnpm run check:coach` passes.
- [ ] `packages/brain` is unchanged. Skip `pnpm run test:brain` unless a brain file shows up in `git diff`.

**Anti-pattern guards**

- Do not restyle warm-up or cool-down.
- Do not turn `exercise-concept.html` into the live editor.
- Do not feed a coach-typed kilogram to `open`, `openingKg`, or `decideNext`.
