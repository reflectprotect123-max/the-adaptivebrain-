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
```

## Android (next)

```bash
bash scripts/sync-coach-apk.sh
cd capacitor && npm install && npx cap add android && npx cap sync android
```

Do not copy TRACK WHOOP URL schemes onto this APK.

## Windows desktop

`desktop/` is the existing Electron shell. Packaged builds still load live Netlify `coach.html` until Capgo/local www is the product path.

## Pushing this tree to GitHub

Brain keeps a snapshot at `apps/coach-side/`. Live GitHub: **https://github.com/reflectprotect123-max/The-coach** (`main`).
