# Adaptive Brain ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Adaptive Brain as the shared contract and routing layer that talks to Strength (`strengthside`) and Engine (`Engine-side-`) without becoming a second progression engine.

**Architecture:** Canonical `00-*` contracts live here. Strength-owned evidence routes to `strengthside`. Conditioning/recovery/WHOOP evidence routes to `Engine-side-`. Cross-product misc stays here. ZIP `10-src/` snapshots are provenance only.

**Tech Stack:** Markdown contracts, JSON rule/test vectors, existing HTML/JS apps in the sibling repos, Supabase already used by both apps.

## Global Constraints

- Brain must not implement Strength load/RIR suggestions or Engine output-anchor / EMH math.
- Prescribed values and actual results stay separate; never save a suggestion as an actual.
- Do not restore Concept2 Logbook OAuth; Concept2 remains a manual/device modality.
- Do not import TrainHeroic history into Engine conditioning storage.
- Do not claim V1 WHOOP HRR coefficients are Morpheus or WHOOP formulas.
- Do not add personal split or personal RHR episode back into the evidence pack.
- Do not add pain/cooked/technique prompts to either core logging loop.

---

## File map

| Path | Responsibility |
| --- | --- |
| `docs/contracts/00-*.md` / `00-*.json` | Target product contract |
| `docs/handoff-misc/` | Cross-product research and design from `M/` |
| `docs/audits/` | Untruncated inventories and every-file ownership |
| `.cursor/skills/` | Installed agent skills |
| `vendor/github/` | Upstream GitHub snapshots |
| sibling `strengthside` | Strength product + `S/` domain packs |
| sibling `Engine-side-` | Engine product + `C/` domain packs |

---

## Task 1: Freeze the contract in Adaptive Brain

**Files:** `docs/contracts/*` (already copied from `M/`)

- [x] Copy `00-HANDOFF.md`, `00-DECISION-WORKTREE.md`, `00-FORMULAS-AND-RULES.md`, `00-BUILD-SPEC.md`, `00-EVIDENCE-REGISTER.md`, `00-MANIFEST.md`, `00-RULE-CONFIG.json`, `00-TEST-VECTORS.json`.
- [ ] Validate both JSON files parse.
- [ ] Commit.

## Task 2: Keep the untruncated audit

**Files:** `docs/audits/inventory-*.md`, `docs/audits/OWNERSHIP-EVERY-FILE.md`

- [x] Inventory every file in S, C, M, and `screen shots/`.
- [x] Classify all 699 files (no omitted rows).
- [ ] Commit.

## Task 3: Do not fork 10-src into this repo

- [ ] Leave `S/10-src/str/` and `C/10-src/eng/` out of Adaptive Brain working tree.
- [ ] Record snapshot SHAs in the spec (`7a7027c` strength, `62516cc` engine).
- [ ] Future work happens in those GitHub repos, then Brain consumes results.

## Task 4: Route Strength pack (separate PR on strengthside)

**Copy into strengthside (not this repo):** `S/01-strength/`, `S/04-research-audits/`, `S/06-trainheroic-source-data/`.

First Strength build after copy: one canonical decision table + tests for straight sets, then shadow-mode over TrainHeroic history.

## Task 5: Route Engine pack (separate PR on Engine-side-)

**Copy into Engine-side-:** `C/01-current-system/`, `C/02-conditioning/`, `C/03-recovery-readiness/`, `C/04-research-audits/`, `C/05-source-programs/`, `C/07-wearables-integrations/`, and `docs/handoff-engine/morpheus-hub-lessons/`.

First Engine build after copy: follow `00-HANDOFF.md` build order (EMH enums → actual-output-first Echo/Concept2 → anchors → continuous Easy → WHOOP HRR shadow).

## Task 6: Morpheus Hub screenshots belong on Engine

**Files:** `docs/handoff-engine/morpheus-hub-lessons/` (14 PNGs + README)

- [x] Read every screenshot. They are Morpheus Hub method lessons (zone-based cardio), captured in ChatGPT, not Adaptive Brain UI.
- [x] Caption index in that README (Steady State Z1/Z2 through Red Max; `172239`/`172249` are duplicates).
- [ ] Copy with the rest of the Conditioning pack onto `Engine-side-` in the routing PR.

## Task 7: Brain product surface (later, after Tasks 4–5)

Brain reads both domains and explains today’s call. It does not suggest kg or RPM.

Minimum Brain job: readiness/context, which surface owns the session, and a pointer to the contract version (`ruleVersion` from `00-RULE-CONFIG.json`).
