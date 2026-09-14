# THE Hybrid — Coach side

This is **Coach**, not TRACK and not Engine.

- **GitHub:** `https://github.com/reflectprotect123-max/The-coach`
- **Android id:** `com.hybrid.coach` (same as the Windows Electron `appId`)
- **UI:** `coach.html` (locked Hybrid Coach home). `index.html` is the older workspace; Capacitor wraps **`coach.html`** as `www/index.html`.
- **Do not** merge gym loggers into this app. Totem and WHOOP ingest come **after** the APK exists.

## Tests

```bash
node coach-apk-shell.smoke.mjs
node coach-bridge.smoke.mjs
node coach-capgo.smoke.mjs
node coach-apk-ci.smoke.mjs
```

## Capgo OTA (Capacitor)

App id **`com.hybrid.coach`**. Channel **`live`** (pinned at boot). `autoUpdate` on. Handshake: `notifyAppReady` in `coach-native-bridge.js`.

Create the Capgo app `com.hybrid.coach` in the Capgo dashboard (human). Then:

```bash
bash scripts/sync-coach-apk.sh
CAPGO_TOKEN=... CAPGO_BUNDLE_VERSION=1.0.0 bash capacitor/scripts/ship-capgo.sh
```

Do not upload Coach bundles to `com.hybrid.athlete` or `com.hybrid.engine`.

## Android APK via GitHub

GitHub Actions builds the debug APK (same pattern as TRACK `strengthside`).

- **Product repo:** push `The-coach` `main`, or **Actions → Coach dogfood APK → Run workflow**. Release **`coach-apk-latest`**.
- **Until that overlay lands:** Brain repo Actions **Coach dogfood APK** publishes the same asset on `the-adaptivebrain-` release **`coach-apk-latest`**.

Install: Releases → `the-hybrid-coach-dogfood-debug.apk`. Then Capgo `live` updates HTML.

Local (needs Android SDK): `bash capacitor/scripts/build-dogfood-apk.sh`

## Windows desktop

`desktop/` is the existing Electron shell. Packaged builds still load live Netlify `coach.html` until Capgo/local www is the product path.

## Pushing this tree to GitHub

Brain keeps a snapshot at `apps/coach-side/`. Live GitHub: **https://github.com/reflectprotect123-max/The-coach** (`main`).
