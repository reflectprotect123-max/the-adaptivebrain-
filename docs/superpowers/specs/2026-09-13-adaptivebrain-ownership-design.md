# Adaptive Brain ownership — design

**Date:** 2026-09-13  
**Status:** file-routing / ZIP ownership only. **Product V1 rules live in** `docs/superpowers/specs/2026-09-13-adaptivebrain-v1-design.md` (supersedes Strength RIR and “Brain is not the progression engine” for V1: Brain owns `decideNext`; apps are UI).  
**Authority:** V1 spec + `docs/contracts/00-FORMULAS-AND-RULES.md`; V1 spec wins on Strength effort (EMH not RIR)

## What landed

Three ZIPs on `main` (`Add files via upload`):

| ZIP | Internal root | Files | Role |
| --- | --- | ---: | --- |
| `Hybrid-Strength-CoLocated.zip` | `S/` | 522 | Strength-owned evidence + `10-src/str/` snapshot |
| `Hybrid-Conditioning-CoLocated.zip` | `C/` + nested `Hybrid-Conditioning.zip` + `screen shots/` | 131 in `C/` + 14 screenshots | Engine-owned evidence + `10-src/eng/` snapshot |
| `Hybrid-Misc-Shared.zip` | `M/` | 32 | Cross-product / does not belong to one app |

Complete untruncated inventories: `docs/audits/inventory-*.md`.  
Every-file owner table (699 files, no rows dropped): `docs/audits/OWNERSHIP-EVERY-FILE.md`.

## Product split (locked by the handoff)

| Surface | Repo | Athlete input | Owns |
| --- | --- | --- | --- |
| Strength / TRACK | `reflectprotect123-max/strengthside` | load, completed reps, RIR | templates, set architecture, exercise history, load suggestions |
| Engine | `reflectprotect123-max/Engine-side-` | actual average output + Easy/Medium/Hard | methods, timers, HR zones, output anchors, interval suggestions |
| WHOOP morning layer | Engine (implementation) | imported Recovery | daily zone shift + module ceiling; never overwrites a confirmed output anchor |
| **Brain** | **this repo** | context / explanation | cross-product scheduling, receipts, coach explanation — **not a second progression engine** |

Shared principle: suggest → perform → log actual → calculate from actual. Strength and Engine **do not share mathematics**.

## Approaches considered

1. **Leave the ZIPs as the only copy.** Cheap. Unusable for day-to-day work; duplicates 00-* three times; 10-src snapshots go stale.
2. **Extract everything into Adaptive Brain and treat this repo as the archive.** Easy to search. Violates the product boundary: Brain would hoard Strength and Engine domain files and the 10-src trees would fork the two apps.
3. **Recommended: Brain holds the shared contract; domain packs route to the two apps; 10-src is reference-only.** Canonical `00-*` live here. Strength folders go to `strengthside`. Conditioning/recovery/WHOOP folders go to `Engine-side-`. Misc/research/product-design stay here until a later split. Do not commit `10-src/` as live code.

## What belongs where

### This repo — Adaptive Brain

- Canonical `docs/contracts/00-*` (handoff, decision worktree, formulas, build spec, rule config, test vectors, evidence register, manifest).
- Misc pack: Strength-vs-Conditioning depth audit, categorized inventory, research batches, Jason Brown combined program, Everyday Responder comparison, product/technical design, coaching-platform market research, archive limitations.
- Installed agent toolchain (`.cursor/skills/`, `vendor/github/`).
- Ownership audits under `docs/audits/`.

Brain may **read** Strength and Engine domains. It must not re-implement load suggestions or EMH/output anchors.

### `strengthside`

- `S/01-strength/` (120-exercise library, progression synthesis, system contract).
- `S/04-research-audits/` Peak/Garage set-weight audit.
- `S/06-trainheroic-source-data/` as historical source, not an auto-import into the live plan.
- Live code already in that GitHub (snapshot commit `7a7027c…` is older than HEAD; treat ZIP 10-src as provenance).

Still incomplete there (handoff): executable tables + tests for every set architecture; shadow-mode over TrainHeroic history.

### `Engine-side-`

- `C/01-current-system/`, `C/02-conditioning/`, `C/03-recovery-readiness/`, `C/04-research-audits/`, `C/05-source-programs/`, `C/07-wearables-integrations/`.
- Conditioning ZIP root `screen shots/` — 14 Morpheus Hub lesson captures (Steady State Z1/Z2, Tempo, Blue Zone Repeats, Green Power/Endurance/Repeats/Threshold, Red Power/Endurance/Threshold/Max). Identified and stored at `docs/handoff-engine/morpheus-hub-lessons/`.
- Live code already in that GitHub (snapshot `62516cc…`).

Known Engine gap vs this contract: still numeric RPE + cooked/stopped; fixed % watts/RPM instead of target-relative tables; split seconds instead of watts; anchors / 90% completion / 5% fade / continuous progression / WHOOP HRR V1 not wired end to end.

### Unassigned (park here until mapped)

- Nested `Hybrid-Conditioning.zip` inside the Conditioning ZIP — duplicate archive, do not treat as a fourth source of truth.
- Other machines beyond Echo and Concept2 — OPEN in the decision worktree.
- Personal lifting split and personal RHR episode — excluded on purpose; do not restore.

## Skills installed in this repo

41 Cursor skills under `.cursor/skills/` (union of Engine + strengthside + `install-skill` + `managing-skills` + `find-skills`). Full upstream GitHub trees remain in `vendor/github/`.

## Error / conflict rule

1. `docs/contracts/00-*` = target product.  
2. Live GitHub apps = current implementation (including debt).  
3. Dossiers = research.  
4. Practitioner programs and TrainHeroic exports = references only.  
5. A file marked superseded never overrides the contract.
