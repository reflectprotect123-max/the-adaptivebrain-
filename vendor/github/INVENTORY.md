# Installed GitHub repos (pulled from sibling apps)

Shallow snapshots of every **GitHub source that was actually installed** in
`strengthside` and `Engine-side-` (skills lockfiles, `skills.md`, Engine
`HANDOFF.md`). Nested `.git` directories were stripped so this tree can live
inside Adaptive Brain.

These are **agent toolchain**, not product engines. They do not belong to
Strength TRACK or The Engine as app code. They live here because this repo is
the shared brain that talks to both apps.

| Local path | Upstream | Found in | What it is |
| --- | --- | --- | --- |
| `AgriciDaniel/claude-obsidian` | [AgriciDaniel/claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) | strengthside `skills.md` (INSTALLED) | Wiki / Obsidian vault skill tree |
| `anthropics/skills` | [anthropics/skills](https://github.com/anthropics/skills) | both (`frontend-design`) | Anthropic public skills pack |
| `aradotso/trending-skills` | [aradotso/trending-skills](https://github.com/aradotso/trending-skills) | Engine HANDOFF + awesome-design-md | Skill catalog / pattern for design.md |
| `Graphify-Labs/graphify` | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | both (INSTALLED CLI `graphifyy`) | Knowledge-graph CLI + Cursor skill |
| `JuliusBrussee/caveman` | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) | both | Caveman / cavecrew token-compression skills |
| `Leonxlnx/taste-skill` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | Engine `skills-lock.json` | `design-taste-frontend`, `image-to-code` |
| `nextlevelbuilder/ui-ux-pro-max-skill` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | both (vendored skill) | UI/UX Pro Max + banner/brand/slides siblings |
| `obra/superpowers` | [obra/superpowers](https://github.com/obra/superpowers) | strengthside `skills.md` | Superpowers process skills |
| `supabase/agent-skills` | [supabase/agent-skills](https://github.com/supabase/agent-skills) | both | `supabase` + postgres best-practices skills |
| `supabase/cli` | [supabase/cli](https://github.com/supabase/cli) | Engine HANDOFF | Supabase CLI source (docs + skill pack cited) |
| `thedotmack/claude-mem` | [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | both (`mem-search`) | Cross-session memory + mem-search skill |
| `vercel-labs/agent-skills` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Engine `skills-lock.json` | `web-design-guidelines` |
| `VoltAgent/awesome-design-md` | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | Engine | Design.md collection |

## Recorded but not cloned

| Source | Why not cloned |
| --- | --- |
| [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) | Installed as Obsidian **1.13.7 `.deb`** on the Engine agent VM, not as a git checkout. That repo is a release dump of binaries. |
| Cursor-native skills (`env-setup`, `subscribe`, `canvas`, `walkthrough-artifacts`, `migrate-to-builds`) | Ship with Cursor; Engine HANDOFF says not to copy them. |
| Design-system *links* inside taste-skill (Fluent UI, Carbon, Polaris, GOV.UK, USWDS, Radix, shadcn, Primer, Material) | Documentation references, never installed. |
| Evidence-archive research repos (Concept2 / Echo / FTMS) | Research citations in strengthside evidence platform, not installed toolchains. |
| `reflectprotect123-max/strengthside`, `Engine-side-`, `THE-HYBRID-ENGINE1` | Sibling product repos. This brain talks to them; they are not nested here. |
| `reflectprotect123-max/the-brain` | Cited in old strengthside handoff; GitHub returns 404 for this token. |

## Classification (where this sits vs the two apps)

| Bucket | Contents |
| --- | --- |
| **Strength & conditioning (product)** | None of these GitHub installs. S&C product code stays in `strengthside` / `Engine-side-`. |
| **Shared brain / doesn’t belong to one app** | This entire `vendor/github/` tree — skills, CLIs, design packs used while building both apps. |
| **Unknown / still parking** | Obsidian `.deb` (VM-only), Graphify PyPI runtime (`graphifyy` — source is here, the installed binary is not), Claude Mem worker build + API keys (must stay out of git). |
