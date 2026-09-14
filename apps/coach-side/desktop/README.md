# THE Hybrid Coach — Windows desktop shell

Thin Electron wrapper around the **live** coach workspace at
`https://thehybridsystem.netlify.app/coach.html`.

## OTA model

| Layer | Updates how |
| --- | --- |
| Coach UI (HTML/JS) | Netlify deploy on `main` — same as browser |
| This `.exe` shell | **Auto-update** from GitHub Releases (`electron-updater`) |

### Coach UI (always live)

Press **Ctrl+R** (or Coach → Reload coach) to pull the latest Netlify coach after a deploy.

### Shell (.exe) auto-update

Packaged installs check GitHub Releases on startup (~5s after launch) and download
updates in the background. When ready, a dialog offers **Restart now** to install.

Manual check: **Coach → Check for app updates**.

**First OTA-capable installer:** `1.0.1`. If you installed `1.0.0`, download and install
`1.0.1` once — after that, shell updates are automatic.

**Permanent download:** [Coach Desktop (latest)](https://github.com/reflectprotect123-max/strengthside/releases/tag/coach-desktop-latest)
(same rolling-release pattern as [Dogfood APK (latest)](https://github.com/reflectprotect123-max/strengthside/releases/tag/dogfood-latest)).

Bump `apps/desktop/package.json` `version` before each shell release so the updater
detects a new build.

## Local dev (latest coach UI before Netlify deploy)

```bash
bash apps/desktop/start-local-coach.sh
```

That syncs `preview-site`, serves it on port **8765**, and opens Electron against
`http://127.0.0.1:8765/coach.html`.

Manual equivalent:

```bash
bash apps/mobile/sync-hybrid-html.sh
cd apps/mobile/preview-site && python3 -m http.server 8765
# new terminal:
cd apps/desktop && HYBRID_COACH_URL=http://127.0.0.1:8765/coach.html pnpm start
```

Or open `http://127.0.0.1:8765/coach.html` in Chrome — same UI, no Electron.

## Local dev (live Netlify coach)

```bash
cd apps/desktop
pnpm install
pnpm start
```

Override URL: `HYBRID_COACH_URL=https://thehybridsystem.netlify.app/coach.html pnpm start`

## Build Windows installer (on Windows)

```bash
pnpm run dist          # local build, no publish
pnpm run dist:publish  # build + GitHub Release (needs GH_TOKEN)
```

Output: `apps/desktop/dist/THE-Hybrid-Coach-Setup-<version>.exe`

Or push to `main` (when `apps/desktop/**` changes) or dispatch **Build coach desktop**
in GitHub Actions.

## What this does NOT do

- Does not bundle or fork coach HTML — zero changes to `coach.html` / `coach-*.js`
- Does not replace Netlify or Capgo athlete OTA
- Does not code-sign (SmartScreen “unknown publisher” until a cert is added)
