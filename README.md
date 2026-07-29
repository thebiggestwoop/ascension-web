# Ascension Web

A companion web app for **Ascension** (Beta 0.8 rules) — a character builder built around
Ascension's Lifepath creation system, an interactive character sheet, and a rules reference.
Structured similarly to [CompCon](https://github.com/massif-press/compcon), the Lancer TTRPG's
companion app.

The full rules document lives at `Ascension_BETA 0.8 Rules/Ascension_BETA0.8Rules.html`.

## Stack

Vue 3 (Composition API) + TypeScript + Vuetify 3 + Pinia + Vite, with a local-first
(IndexedDB-backed) persistence model. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how the
codebase is laid out.

## Getting started

```
npm install
npm run dev
```

## Project roadmap

- **Phase 0 — Groundwork (current).** Repo, tooling, folder architecture, stub domain types,
  and a handful of seeded content examples proving the data schema.
- **Phase 1 — Core data layer.** Fully transcribe the rulebook into `content/*.json`: all
  Social Classes, Upbringings, Educations, Careers, Life Events; the full weapon/armor/mount/
  general-equipment catalogs; every Narrative Archetype and Combat Talent Tree; the Arcane/
  Light/Dark spell lists. Flesh out `src/classes/` with full controller composition.
- **Phase 2 — Character Builder.** The generic Lifepath wizard (driven by `content/lifepath/*.json`)
  plus a Standard Array fast-path, wired to a live character draft with validation (Attribute
  sum 56, Skill sum 14, rating caps, etc).
- **Phase 3 — Character Sheet.** Interactive, inline-editable sheet sections computed from the
  `Character` model, with local persistence.
- **Phase 4 — Rules Reference / Compendium.** A browsable UI mirroring the rulebook's chapter
  structure, with a unified searchable index across equipment/talents/spells/rules text.
- **Phase 5 — Polish.** Character export/import, print view, responsive layout.
- **Phase 6 — GM tooling (later).** NPC/Bestiary compendium, encounter helpers, Adjutant sheets.
- **Phase 7 — Mass Combat / Armies (later).** Army builder and mass-combat tracker.
- **Phase 8 — Optional homebrew content-pack format**, if/when the game grows a community of
  third-party content creators.

Dice rolling is intentionally out of scope for this app — it's handled by a separate existing
project that isn't being integrated at this stage.
