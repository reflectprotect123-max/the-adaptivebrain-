# the-adaptivebrain-

**Agents:** if the human says **read the handoff**, open [`HANDOFF.md`](HANDOFF.md). That is the current V1 start (not `docs/contracts/00-HANDOFF.md`).

## Coach workspace and Windows app

The Coach UI (`apps/coach`) and Windows installer (`apps/desktop`) now live here.
See [Coach setup and release instructions](apps/coach/README.md).
[Download the current installer](https://github.com/reflectprotect123-max/the-adaptivebrain-/releases/tag/coach-desktop-latest).
The athlete app continues to live in strengthside; moving Coach does not change
its Capgo bundle or workout behavior.

Shared brain for the two apps:

- [strengthside](https://github.com/reflectprotect123-max/strengthside) — Strength / TRACK
- [Engine-side-](https://github.com/reflectprotect123-max/Engine-side-) — conditioning Engine

## GitHub sources installed in those apps

Installed Cursor skills live under [`.cursor/skills/`](.cursor/skills/) (608 skills).
Upstream URLs are recorded in [`vendor/github/INVENTORY.md`](vendor/github/INVENTORY.md),
with combined pins in [`skills-lock.json`](skills-lock.json). Full upstream source
snapshots and historic handoff ZIPs are recoverable from the
[archive commit](vendor/github/ARCHIVE.md), rather than copied into the product tree.

## Handoff package (uploaded ZIPs)

Current product/agent handoff: [`HANDOFF.md`](HANDOFF.md).

The original `Hybrid-Strength-CoLocated.zip`, `Hybrid-Conditioning-CoLocated.zip` and
`Hybrid-Misc-Shared.zip` remain available in the [archive](vendor/github/ARCHIVE.md).

- Older ZIP contract (superseded where it disagrees with `HANDOFF.md` + V1 spec): [`docs/contracts/00-HANDOFF.md`](docs/contracts/00-HANDOFF.md)
- Formulas and numbers: [`docs/contracts/`](docs/contracts/)
- Untruncated inventories: [`docs/audits/`](docs/audits/)
- Every-file owner table: [`docs/audits/OWNERSHIP-EVERY-FILE.md`](docs/audits/OWNERSHIP-EVERY-FILE.md)
- Design: [`docs/superpowers/specs/2026-09-13-adaptivebrain-ownership-design.md`](docs/superpowers/specs/2026-09-13-adaptivebrain-ownership-design.md)
- Plan: [`docs/superpowers/plans/2026-09-13-adaptivebrain-ownership.md`](docs/superpowers/plans/2026-09-13-adaptivebrain-ownership.md)
