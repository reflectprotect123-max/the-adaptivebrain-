# Coach now uses the exported APK strength builder

## Cause

The prior Coach migration moved the existing Coach editor. Exporting the newer athlete builder into the `workout-builder-export` release did not connect it to Coach. The previous bloat cleanup changed packaging and persistence, not the editor implementation.

## Implementation

The source of `apps/coach/builder/{library.js,library-ui.js,library.css,strength-targets.js}` is the APK builder exported from `reflectprotect123-max/strengthside` commit `5551ef5a4394f16582c3a9687c38bb1e02859508` (the source pinned in that repository's builder export script). This imports the real model and view, rather than reproducing the old Coach prescription dialog.

Coach opens that builder for strength templates, including existing templates. Its warm-up → lift cards → cool-down flow, numbered sets, photo keypad, range entry, final AMRAP at first working-set weight, tempo dropdown, circuits and supersets are retained. Coach's shell and athlete calendar stay in place. Pure engine templates continue using their engine editor; engine blocks in mixed templates are retained without rewriting their data.

Small integration differences from the exported source:

- Model/view/targets bind to `CoachBuilderHost`, keeping athlete-style state isolated from Coach's account/calendar state.
- `host.js` translates old templates into authored lift/circuit blocks. It retains exercise IDs and existing exercise metadata/load/history fields in Coach's compatibility overlay. Existing assigned sessions remain independent snapshots.
- Canonical lift/circuit fields survive the existing calendar instantiation, CoachBridge and Supabase snapshot path. No database migration or athlete APK change is required.
- Calendar posting selects a Coach athlete and saves an unpublished session. Existing calendar Publish sends it. It does not write athlete-local date assignments.
- All supported TrainingCore metric options remain selectable, including Coach's previously restored extra metrics.
- Legacy duplicate catalogue rows remain available for resolving existing IDs, but are hidden in fresh picker results. Newly created exercises/circuits persist in `builderCatalog`.
- Source CSS is scoped to the imported builder; host overrides supply APK tokens and desktop positioning. The keypad resets on switching sessions; title/instructions save while typing.
- Only the shared desktop/OTA asset inventory ships these six builder assets. Source tests and athlete contract fixtures are excluded from production.

The source's prep defaults remain unchanged (five movements, three rounds; 180 seconds for Bike/Row/Run/Ski, 60 for Jump Rope). This import does not redesign those defaults or add duration/round editing controls to the locked prep screens. Coach-posted sessions remain drafts until published.

## Validation

- 23 imported view regression tests, with loading adapted to this ESM workspace and the metric assertion updated to preserve Coach's full metric contract.
- Adapter regression tests cover old variable reps/ranges, supersets, prep instructions, retained loads, original exercise IDs, frozen assigned sessions, full metrics, custom catalogue persistence and duplicate-free fresh choices.
- Actual athlete assignment conversion is tested using pinned fixtures from strengthside `679c4a88a1871f688d086219b82d43d185875860` (`coach-assignments.js`, `strength-only.js`). These fixtures are not shipped.
- Browser journeys exercise real controls: warm-up, catalogue selection, 10/8/6, final AMRAP, 33X1, cool-down, selected date, Coach calendar Publish, reload/reopen, ranges and pounds. Existing returned-result, compact-save and downloaded file-bundle/storage/startup checks remain.
- `pnpm run verify` also runs brain, Coach cloud/delivery and desktop updater checks.
- CLI screenshots are retained under `/workspace/artifacts/coach-builder-import/` in this execution environment.

Browser publishing uses offline demo state; live Supabase account delivery and physical Windows/Android installation are not claimed as tested by this change.
