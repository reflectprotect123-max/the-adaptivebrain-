# THE Hybrid Coach — Windows desktop shell

The Electron app bundles the coach workspace from `apps/coach/`. The screen
works locally and does not depend on a hosted HTML site. Supabase provides the
account, WHOOP, and coach API routes.

The Windows shell updates from GitHub Releases (`electron-updater`). Because
the coach UI ships inside the installer, UI changes also require a new desktop
build.

## Run locally

```bash
cd apps/desktop
pnpm install
pnpm start
```

To open a temporary local server during UI work, set `HYBRID_COACH_URL` to a
local URL. Otherwise Electron opens `apps/coach/coach.html` directly.

## Build a Windows installer

```bash
pnpm run dist          # local build, no publish
pnpm run dist:publish  # build + GitHub Release (needs GH_TOKEN)
```

The installer is written to `apps/desktop/dist/`. Bump
`apps/desktop/package.json` `version` before each shell release.

## Scope

- App identity: `com.hybrid.coach`.
- UI files are bundled from `apps/coach/` into the installer.
- Supabase handles account and integration requests.
- No hosted-site UI reload or third-party deploy service is involved.
- The app is not code-signed; Windows may show SmartScreen until a signing
  certificate is configured.
