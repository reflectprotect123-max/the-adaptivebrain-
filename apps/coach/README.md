# Coach workspace

The Coach web UI and Windows installer live in this repository. The live athlete
application remains in `reflectprotect123-max/strengthside`. Both use the existing
Supabase project and account/session contracts.

From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium
corepack pnpm run verify
python3 -m http.server 4173 --directory apps/coach
```

Open `/coach.html` on that local server. The offline demo is available on the login
screen. Use an existing Supabase account for cloud publishing and WHOOP.

Build the Windows app with `corepack pnpm --filter @hybrid/coach-desktop run dist`.
Main-branch changes to Coach or desktop files publish the `coach-desktop-latest`
release in this repository. Version 1.0.3 uses this repository for subsequent
updates; install it once to replace an earlier installer using the old release feed.

The migration preserves the Coach UI from strengthside commit
`7d92c5b6e062e8a85f853d35bd6594731ca43056`. Cross-app regression fixtures are frozen
under `fixtures/` and excluded from the installer. Shared browser contracts are
versioned here with Coach; do not fetch mutable sibling-repo files at runtime.

### Strength assignment completion

Publishing and unpublishing resolve the canonical `assigned_session` by athlete + Coach session key. Published snapshots stay frozen; duplicate a workout to publish changed content. An unchanged re-publish preserves its original publication time. Dates can move through `scheduled_date`.

The strength app returns completed actuals and its canonical engine estimates in `assigned_session.athlete_result`. Calendar chips show Completed and expandable Results. This requires strengthside migration `20261018040000_coach_assignment_results.sql` **before either updated client is released**. Strength owns that table/RPC; do not create a second schema or calculate the returned e1RM again in Coach. Receipt and ownership details live in strengthside `docs/coach-assignment-results.md`.

The Coach/Strength UI journey was rerun through Playwright CLI using an isolated HTTP/auth adapter and real disposable PostgreSQL/RLS/freeze rules. This is not live-auth, physical-APK or Windows-installer certification. No desktop release or Capgo deployment is part of these workflow fixes.
