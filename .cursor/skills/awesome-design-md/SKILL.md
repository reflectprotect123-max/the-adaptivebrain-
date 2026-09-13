---
name: awesome-design-md
description: Use curated DESIGN.md files from popular websites to give AI coding agents instant design system context for building pixel-perfect UI. Use when asked for awesome DESIGN.md, a real-site design system, or to make UI look like Stripe/Vercel/Linear.
---

# Awesome Design MD

Curated `DESIGN.md` files reverse-engineered from popular sites (VoltAgent collection). This skill vendors them under `design-md/<site>/DESIGN.md`.

## Engine-side- override

This product already has a visual system: `design-system/the-hybrid-engine/MASTER.md` (Track Dawn — copper on charcoal, Engine zone teal). **Do not replace that with a copied DESIGN.md unless the user explicitly asks to restyle after a named site.** For Engine UI work, MASTER.md wins.

## How to use

1. Pick a site folder under this skill's `design-md/` (e.g. `vercel`, `linear.app`, `stripe`).
2. Read that folder's `DESIGN.md`.
3. Apply tokens/components from it only for the surface the user named.
4. If they want a project-root `DESIGN.md`, copy the chosen file there and say which site it came from.

## Sources

- Skill pattern: https://github.com/aradotso/trending-skills/tree/main/skills/awesome-design-md
- Collection: https://github.com/VoltAgent/awesome-design-md
