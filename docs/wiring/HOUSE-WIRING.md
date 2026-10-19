# Hybrid house wiring (product + backend)

The Adaptive Brain is the **fuse box**. Athletes never stand in this room. Strength and Engine are the **rooms**. Coach writes the session. The **basement** is backend. Wires are messages, not shared UI.

The picture is [`index.html`](index.html): one orb, each piece selectable, with the sentence for what it does.

## Fuse box (main breaker)

Node: Adaptive Brain kernel (`packages/brain`, `HybridBrainKernel` in the apps).
Owns: `open`, `decideNext`, `close`, `confirmAnchor`, `dailyZones`.
Does not own: screens, timers, WHOOP login, Capgo upload, coach chat math.

Rule current: `RULE_VERSION` v1.0.0. LLM never feeds `decideNext`.

## How `decideNext` splits (no shared maths)

`session.js` `decideNext(facts)` looks at `facts.kind` only:

- `kind === 'strength'` → `decideNextStrength` (kg steps, EMH vs intended, miss/shortfall −step, hold if missing kg/reps/effort)
- `kind === 'engine'` → `decideNextEngine` (reads `00-RULE-CONFIG.json`; Echo RPM integer deltas; Concept2 watts `Math.round(actual * factor)`; incomplete cannot increase)
- anything else → `{ hold: true }`

The apps copy the same kernel as `brain-kernel.js`. They do not call each other.

## Room: Strength TRACK

Repo: `strengthside` `apps/athlete`. Snapshot: `apps/strength`.
Athlete logs: kg, reps, Easy / Medium / Hard.
Logger talks to Brain: `open` (last kg) → `decideNext` (next row kg) → `close` (lastKg).
Phone OTA: Capgo `com.hybrid.athlete` **1.0.86** (live and dogfood).

## Room: Engine

Repo: `Engine-side-`. Snapshot: `apps/engine`.
Athlete logs: actual output, Easy / Medium / Hard after rest.
Logger talks to Brain: `open` (typed number or last Close) → `decideNext` → `close` (`confirmAnchor`).
Phone OTA: Capgo `com.hybrid.engine` **1.0.7**. Assemble www must copy `brain-kernel.js`.

## Basement: one Supabase project

Project: `orysjncrksmdfabpuftd.supabase.co` (Auth + Postgres + Edge).

| Edge function | Job |
| --- | --- |
| `www` | Engine public site |
| `strength` | TRACK HTML on the same project |
| `brain` | Brain landing page |
| `whoop-connect` / `whoop-callback` / `whoop-webhook` / `whoop-sync` / `whoop-health` | WHOOP OAuth + inbound events |
| `integrations-status` / `integrations-disconnect` | connection UI |
| `brain-coach` | OpenRouter coach (sign-in required; no `decideNext`) |
| `off-proxy` | nutrition OFF proxy |

Postgres schema `engine.integration_kv` holds WHOOP tokens (`token:whoop:u:<uuid>` Engine, `token:whoop:s:<uuid>` TRACK). Service role stays on Edge. Client uses anon + user JWT.

Engine `ENGINE_CONFIG.functionsProvider` is `'supabase'`. Public origin: `/functions/v1/www/`.

## Strength web still uses Netlify as a porch

Athlete HTML / Netlify: `thehybridsystem.netlify.app`.
WHOOP and `brain-coach` Netlify functions are **proxies** (`_hybrid-proxy.mjs`) onto `thehybridengine1.netlify.app` (Brain owner site). Tokens do not live on the athlete site.
Strength `whoop.js` still talks Netlify for those functions, plus the **same** Supabase Auth project for the user session.
Concept2 Netlify functions exist in the tree but Logbook OAuth is **retired / parked**.

## Morning circuit: WHOOP

Live connect is **only** Supabase Edge `whoop-connect` (401 without a user JWT).  
`thehybridsystem.netlify.app` and `thehybridengine1.netlify.app` `/.netlify/functions/whoop-connect` are **404**. Strength APK must use Edge + `x-hybrid-product: strength`, same as Engine.

WHOOP developer dashboard must list Engine callback + webhook Edge URLs.
Recovery maps into local check-in, then `dailyZones` on Engine **home**.
WHOOP does not call `decideNext` and must not rewrite a confirmed output anchor.

## Local stores (in the rooms)

- Strength: `localStorage` key `THE-brain-v1`
- Engine: `localStorage` key `THE-hybrid-engine-v1`
- Strength plan-sync (optional): Supabase `upsert_athlete_domain_snapshot` domain `strength_side` — templates/calendar copy, not WHOOP, not `decideNext`

## Delivery (not math)

- GitHub: `the-adaptivebrain-` (kernel workshop), `strengthside` `main`, `Engine-side-` `main`
- Capgo Cloud: two apps, dogfood + live channels
- Native shells: Capacitor `@capgo/capacitor-updater`

## Room: Coach

Repo: this one, `apps/coach`. Desktop updates: Coach **1.0.3** from `coach-desktop-latest`.
Demo coach (offline) opens the imported session builder.

Wizard wires:

- Warm-up Next opens the session template. The prep screens stay prep.
- Session Next opens cool-down. The lift cards on that page already carry reps, tempo, and AMRAP.
- Exercise picker Next walks each main-lift group on the reps step, then cool-down.
- A superset or triset is adjacent main lifts that share a `groupId`. The circuits tab is still in the editor as its own block kind.
- The weight cell is a label (`Set 1 weight` on an AMRAP row). `demoStartingKg` is stripped on save. That cell does not connect to `decideNext`.
- Cool-down Next opens the calendar only when a main lift exists. Post is an unpublished draft. Publish freezes the assigned workout for the athlete.

OpenRouter still sits behind Edge `brain-coach` (Strength’s old path was the Netlify porch). Chat does not feed kilograms or watts.

## Shared law

Actual beats suggestion. Never silently save a suggestion as actual unless number and effort both match intended.
