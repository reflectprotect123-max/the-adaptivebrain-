# Coach cleanup — 18 October 2026

Implements the confirmed findings in [the Coach audit](2026-10-18-coach-bloat-audit.md).
The Strength APK and production Supabase exercise/history tables were not modified.

## Removed

- Nine unused athlete brain modules from apps/coach. The unused athlete sync module
  was moved to fixtures, where cross-app contract tests still exercise it.
- Broad release copy patterns: native and Capgo packaging now share coach-assets.json.
- The duplicate full coach.html in Capgo bundles; the SDK loads the single index.html.
- The second full exercise dataset: search and builder share the same canonical array.
- Repeated builtin catalogue serialization in saved state; custom/changed metadata,
  working maxima, e1RM, session prescriptions and old exercise IDs are retained.
- The retired same-device athlete bridge write on every edit. Explicit bridge export
  and cloud payload serialization remain available.
- Unchanged assignment UPDATEs and repetitive background reads: acknowledgements are
  scoped to authenticated coach/athlete/session, expire after 60 seconds, and are
  invalidated on errors. Explicit manual publishing always checks the server.
- Per-assignment full state saves: assignment IDs are saved once per batch. Pending
  IDs remain stable across a failed initial request. Completed receipts stay completed.
- Full Windows builds on every UI/doc/test edit. Verification still runs on main;
  native releases now require explicit workflow dispatch. Capgo promotion remains
  an explicit final release step, not an automatic push of unfinished changes.
- Approximately 306 MB of historic upstream snapshots/root ZIPs from the current tree.
  Recovery links and license notices remain under vendor/github. Git history was not
  rewritten and all 608 installed Cursor skills remain intact.

## Duplicate exercise choices

82 legacy core records with matching Supabase main-library names are hidden from fresh
search/library choices. Their IDs still resolve for old workouts. Legacy shorthand and
aliases transfer to the visible canonical record. Banded entries, warm-up/cool-down
sections and different exercise variations are retained. The remaining same-name
section/variation records were not deleted by a blanket name comparison. No Supabase
catalogue records, working maxima or training history were deleted.

## Measurements

- Staged web assets: approximately 876 KB, previously 1,452 KB — about 40% smaller
  before compression. Final exact values are retained in the local artifact report.
- Same demo state: full in-memory JSON 563,115 characters; compact saved JSON 34,416
  characters. The runtime still has all 2,120 catalogue records after reloading.
- Visible catalogue choices: 2,038; all 2,120 original IDs remain addressable.
- Windows packaging is configured for en-GB/en-US and excludes source maps. The prior
  installer included 41,230,903 bytes of other locales and 993,225 bytes of source maps.
  These are uncompressed prior-artifact measurements; installer savings require a new
  native build and inspection, not a claim based on configuration alone.

## Verification

Tests cover compact migration from full v1 saves, custom metadata/history retention,
canonical search and shorthand, preserved prep/banded variants, account-scoped publish
acknowledgements, frozen prescriptions, completed receipts, retry/auth handling and
20-session batch identity persistence. Browser checks cover builder edit/reload, metrics,
returned athlete results, redraw races and the native/OTA startup health handshake.
The new browser regression also verifies that edits do not recreate the retired bridge.

Run `pnpm run verify`. Release artifacts are additionally checked against the shared
asset inventory, updater dependencies and intended locale/source-map exclusions before
claiming a published installer contains the cleanup.
