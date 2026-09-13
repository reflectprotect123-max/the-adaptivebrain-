# Package Manifest

## Package identity

- Name: `hybrid-system-complete-handoff-2026-09-12`
- Checkpoint date: 12 September 2026
- Intended use: product and engineering handoff for the combined Strength, Engine, recovery/readiness and research system
- Root authority: `00-HANDOFF.md` and the other root `00-*` contract files

## Root contract

| File | Purpose |
| --- | --- |
| `00-HANDOFF.md` | Authoritative scope, locked decisions, current-code gaps and build order |
| `00-DECISION-WORKTREE.md` | Branch-by-branch decision status and dependencies |
| `00-FORMULAS-AND-RULES.md` | Executable formulas, tables and scientific-status labels |
| `00-BUILD-SPEC.md` | Domain types, receipts, pseudocode, migration and verification plan |
| `00-RULE-CONFIG.json` | Machine-readable V1 constants |
| `00-TEST-VECTORS.json` | Acceptance examples for anchors, machines, completion and zones |
| `00-EVIDENCE-REGISTER.md` | Source hierarchy, key citations and heuristic boundary |
| `00-MANIFEST.md` | Package inventory and provenance |
| `FILES.txt` | Complete relative file listing |
| `CHECKSUMS.sha256` | SHA-256 integrity list; excludes itself |

## Folder inventory

| Folder | Files before final integrity indexes | Contents |
| --- | ---: | --- |
| `01-current-system/` | 7 | System reconstruction, SOPs, evidence dossier and product-depth audit |
| `01-strength/` | 6 | Strength contract, progression research and canonical 120-exercise library in Markdown/CSV/JSON |
| `02-conditioning/` | 8 | Conditioning synthesis, Morpheus adaptation, 16-week spec, source manifest and modality trees |
| `03-recovery-readiness/` | 4 | Recovery/readiness dossiers and evidence handoffs |
| `04-research-audits/` | 15 | Research batches, traceability, Peak/Garage audit and adaptive evidence bundle |
| `05-source-programs/` | 17 | Jason Brown, Built Not Burnt, Everyday Responder and 14 user-supplied Morpheus screenshots |
| `06-trainheroic-source-data/` | 4 | Original recovered export, rebuilt spreadsheet and parsed session library |
| `07-wearables-integrations/` | 2 | Garmin/TrainingPeaks/TrainHeroic history and WHOOP/Morpheus design provenance |
| `08-limitations/` | 2 | Recovery limits and prior archive gap audit |
| `09-product-design/` | 2 | Technical architecture and coaching-platform market research |
| `10-src/` | 581 | Dependency-free Engine (`eng`) and Strength (`str`) reference snapshots plus snapshot boundary |

The source-reference count is high because it includes the TrainHeroic coach-spec screenshots and mobile application resources needed to understand the existing product. `FILES.txt` is the exact inventory.

The ZIP uses the short internal root `H/`, `10-src/eng/`, `10-src/str/` and `str/docs/research/smrp/` to avoid Windows path-length failures. The longest packaged file path is 119 characters including the `H/` root.

## Source provenance

| Product | Repository | Branch | Snapshot commit |
| --- | --- | --- | --- |
| Engine | `reflectprotect123-max/Engine-side-` | `main` | `62516ccd9954d9f8446b72a12b566bff6d374334` |
| Strength | `reflectprotect123-max/strengthside` | `main` | `7a7027c5c58ac15cfab119a0a1e8a4fac024ea88` |

The package is a handoff snapshot, not a replacement for either Git repository. Git metadata was not copied.

## Included by explicit request

- The original recovered TrainHeroic export and reconstructed database artifacts.
- Strength, conditioning, recovery, readiness, wearables, platform and market research.
- Peak Strength/Garage Strength audit and transparent adaptation principles.
- Morpheus method reference and all 14 user-supplied reference screenshots.
- Decision worktree, formulas, versioned rule configuration, build pseudocode and tests.
- Current Engine and Strength implementation references.

## Deliberately excluded

- The user's personal lifting split.
- The user's personal resting-heart-rate episode.
- Videos, because they were judged unnecessary for the focused evidence package.
- Duplicate historic ZIPs and duplicate source trees.
- Dependency folders such as `node_modules`.
- Git metadata, credentials, `.env` files, generated APK/AAB files and other build artifacts.
- Unrecoverable deleted-chat content that was not present in accessible history or the recovered archives.
- Wholesale copied proprietary course text beyond the user's supplied screenshots and lawful research notes.

These exclusions prevent the package from becoming another oversized forensic archive while preserving the researched evidence and build decisions requested.

## Authority and conflict rule

1. Root `00-*` documents control the target product.
2. Source snapshots show current implementation, including known technical debt.
3. Consolidated dossiers explain research and earlier reasoning.
4. Practitioner materials and historical exports are references only.
5. A file explicitly marked superseded must never override the root contract.

## Known incomplete work

- The latest target rules are specified but not fully implemented in Engine source.
- Strength direction is locked, but every set architecture still needs its own complete executable table and tests.
- Daily WHOOP zone coefficients are an original V1 hypothesis and require shadow-mode validation.
- Machine rules beyond Rogue Echo Bike and Concept2 remain open.
- Morpheus, WHOOP and Peak/Garage proprietary algorithms remain unavailable and are not reconstructed as fact.

## Verification expectations

- Validate both JSON files.
- Confirm the ZIP with `unzip -t`.
- Verify every packaged file against `CHECKSUMS.sha256` from inside the extracted folder.
- Run each repository's own `pnpm verify` after restoring dependencies in a proper development checkout.
