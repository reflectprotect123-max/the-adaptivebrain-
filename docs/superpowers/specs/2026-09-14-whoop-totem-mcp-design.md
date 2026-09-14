# WHOOP via Totem MCP — data in Brain, consume a slice

**Date:** 2026-09-14  
**Status:** locked in chat (keep this)  
**WHOOP adapter:** [thebriangao/totem](https://github.com/thebriangao/totem) (WHOOP MCP; not [mmnto-ai/totem](https://github.com/mmnto-ai/totem))  
**Authority:** this spec for *how WHOOP data enters Hybrid*. Athlete UX and `decideNext` stay in `2026-09-13-adaptivebrain-v1-design.md`.

---

## What we are keeping

Totem is a **wearables bridge**: it authenticates to WHOOP, **projects** raw responses into flat zod-validated objects, and exposes many MCP tools. Adaptive Brain does **not** become those 49 tools.

Pattern (locked):

```
WHOOP  →  Totem (full projection, catalogs, optional coach MCP)
              ↓  only the slice Brain needs
         Adaptive Brain store / kernel dailyZones
              ↓  Engine Home BPM card
         Strength / Engine loggers (unchanged)
```

All WHOOP richness can live behind Totem. Hybrid **uses what it needs**: today’s Recovery (0–100), capture time / freshness, and resting HR when it already feeds `rhr28`. Nothing else from Totem enters `open` / `decideNext` / `close`.

---

## Slice Brain may use

| Field | Source idea (Totem tool family) | Hybrid use |
| --- | --- | --- |
| Recovery 0–100 | `whoop_today` / `whoop_recovery` | `dailyZones({ recovery })` → Blue / Green / Red BPM on Engine **home** |
| Sample time | same | freshness: current vs missing/stale |
| Resting HR | recovery / trend | only if we already maintain `rhr28`; never a new athlete question |

Do **not** pull into Brain or loggers:

- Totem Strength Trainer (`whoop_lift_*`) — TRACK owns `liftMemory` / LAST / e1RM
- `whoop_coach_ask` — LLM never for target math
- Live HR / stress / journal / alarm / writes
- Hypnogram, leaderboards, cycle, smart alarm

Coach chat may talk to Totem as an MCP client later. That chat still cannot rewrite a confirmed output anchor or call `decideNext`.

---

## What stays parked / unchanged

- Logger chrome frozen.
- WHOOP must not soften or replace last Close output.
- **Product ingest (locked 2026-09-14):** Totem is how WHOOP enters Hybrid. Official Edge developer OAuth is **fallback until Totem recovery is proven** — dual-run, then retire the happy path. Do not delete `whoop-*` in the same change as athlete settings switches. Redeploying `whoopCallbackUrl` still unblocks today’s 503 fallback.
- Do not vendor Totem into this repo. Do not copy iOS private-API client code here. Consume Totem as an external adapter (MCP or a future small projection JSON Totem already validates).
- Athlete **back-to-back** (two APKs, Me switches open the other app): `2026-09-14-athlete-back-to-back-design.md`. No merge. Phase 1 of that spec must not change this WHOOP path.

---

## Implementation (not this lock)

Wiring Totem → Brain store is a later task: ingest the slice above, persist beside (not inside) `athlete_domain_snapshots` if needed, Engine Home already calls `HybridBrainKernel.dailyZones`. Until then, Edge sync’s normalized recovery is the phone feed.
