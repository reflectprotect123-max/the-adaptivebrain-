# Hybrid house wiring (product graph)

The Adaptive Brain is the **fuse box**. Athletes never stand in this room. Strength and Engine are the **rooms**. Wires are messages, not shared UI.

## Fuse box (main breaker)

Node: Adaptive Brain kernel (`packages/brain`, `HybridBrainKernel` in the apps).
Owns: `open`, `decideNext`, `close`, `confirmAnchor`, `dailyZones`.
Does not own: screens, timers, WHOOP login, Capgo upload, coach chat math.

Rule current: `RULE_VERSION` v1.0.0. LLM never feeds `decideNext`.

## Room: Strength TRACK

Repo: `strengthside` `apps/athlete`. Snapshot: `apps/strength`.
Athlete logs: kg, reps, Easy / Medium / Hard.
Logger talks to Brain: `open` (last kg) → `decideNext` (next row kg) → `close` (lastKg).
Miss / shortfall steps down. Missing kg, reps, or effort holds.
Phone OTA: Capgo app `com.hybrid.athlete` (dogfood default, live also pinned).

## Room: Engine

Repo: `Engine-side-`. Snapshot: `apps/engine`.
Athlete logs: actual output, Easy / Medium / Hard after rest.
Logger talks to Brain: `open` (typed number or last Close anchor) → `decideNext` (next watts / split / rpm) → `close` (`confirmAnchor`).
WHOOP recovery must not rewrite a confirmed output anchor.
Phone OTA: Capgo app `com.hybrid.engine` (live default). Assemble www must copy `brain-kernel.js`.

## Morning circuit: WHOOP

WHOOP recovery score enters Engine **home** only.
Brain `dailyZones` paints Blue / Green / Red BPM ceilings.
WHOOP is not a second progression engine. It does not call `decideNext`.

## Storage circuits

Strength store: athlete local / `THE-brain-v1` as Strength app uses.
Engine store: `THE-hybrid-engine-v1`.
Anchors live with Engine Close receipts, not in WHOOP.

## Delivery circuits (not math)

Capgo OTA pushes HTML bundles to phones.
GitHub `main` on Strength/Engine is the source tree.
Brain GitHub `the-adaptivebrain-` is the kernel workshop; draft PR until merge.

## Isolated circuit: coach chat

Coach LLM may explain. It must not set kg or watts. No wire from OpenRouter into `decideNext`.

## Shared law on every live wire

Actual beats suggestion. Never silently save a suggestion as actual unless number and effort both match intended.
Dropped: session 1-5 feel. Parked: 2k opening pace, extra machines.
