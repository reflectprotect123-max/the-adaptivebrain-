# Coach desktop live updates

The Windows Coach app uses **@capgo/electron-updater 0.0.6**, pinned separately
from the mobile Capacitor updater. App: `com.hybrid.coach`; channel: `coach-live`.
The channel allows Electron, serves ZIP only, and uses metadata compatibility
with minimum desktop version **1.0.6**. Android/iOS are disabled on this channel.

Install Coach desktop **1.0.6 or newer once** to add the native integration.
Subsequent HTML/JS/CSS changes can ship through Capgo without a new installer.
Native/main-process/preload/dependency changes still require a new desktop
version and the GitHub `Build coach desktop` workflow. The GitHub updater remains
available in **Coach → Check for app updates**.

## User behaviour

A background check runs five seconds after launch. Downloads are SHA-256 checked
and queued for the next complete app restart, never applied on window blur or
while editing. **Coach → Check for Coach updates (Capgo)** checks manually and
reports whether a restart is needed. Reopening loads the queued update.

The renderer acknowledges readiness only after its first successful local render.
Only the main window's exact current bundle URL may acknowledge. The sandboxed
preload exposes that single operation, with no admin key or general update IPC.
Network/cloud login is optional for startup; offline Coach remains usable.

A 20-second shell watchdog explicitly resets a failed bundle to the last healthy
bundle (or builtin if that would select the failing bundle again). A persisted
startup marker also catches a crash before readiness on the following launch.
Rejected versions are not downloaded repeatedly. Installing a new shell resets
the UI to that installer's fresh builtin version.

The wrapper supplies explicit recovery because the pinned SDK's own timeout
reloads the current path rather than selecting the previous bundle. Keep this
regression coverage when changing SDK versions.

## Shipping a UI update

From the repository root, with dependencies installed and a normal Capgo CLI
login (`.capgo` is ignored), or `CAPGO_TOKEN` supplied securely:

```sh
pnpm run verify
bash scripts/ship-coach-capgo.sh 1.0.8
```

Choose a unique bundle version. Version 1.0.7 is the initial live bundle; desktop
1.0.6 ships the same UI as its builtin fallback. The script stages browser assets
only, replaces the redirect index with the real Coach document and validates its
asset references. It preserves the SDK's expected `www/index.html` layout.
Do not upload desktop Node/preload code, credentials, test data or fixtures.

The CLI currently has no Electron project mode. Its supported plain-web Cordova
mode uploads the ZIP with SHA-256. The mobile-only notify scanner cannot see the
Electron main-process acknowledgement, so that scanner alone is skipped; staging
checks and browser/desktop tests verify the actual health handshake. Do not enable
delta, Brotli or encryption without verifying SDK compatibility first.

GitHub's existing Windows workflow publishes installers. UI Capgo uploads use the
script above; no new GitHub Capgo secret was created and no automatic UI upload
workflow is enabled. Never put a publishing token in the Coach UI or repository.

## Verification

`pnpm run verify` includes update-wrapper tests (restart-only queue, integrity
requirements, foreign-frame rejection, offline fallback, breaking-update handling,
startup timeout/crash recovery and installer reset) and a real Chromium file-bundle
startup/storage continuity check. Before the initial release, the real SDK also
fetched the production Electron update response, downloaded and verified the ZIP,
queued it without applying on blur, applied it on a simulated restart and
acknowledged readiness. The Electron runtime/window was stubbed for this SDK test;
physical Windows installation is still a final device check.
