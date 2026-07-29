# Architecture

This mirrors the layering conventions used by [CompCon](https://github.com/massif-press/compcon).

## Layers

- **`content/`** — Bundled rules data (JSON), separate from app code. Core rulebook content
  today; structured so it could later be split into an independently-versioned package, or
  extended with a homebrew content-pack format, without changing the app's shape.
- **`src/classes/`** — Framework-agnostic domain model and rules engine. Plain TypeScript:
  `Character`, `Attribute`, `Skill`, `Talent`, `Equipment`, `Spell`, `Lifepath`. No Vue imports
  here. This is where game rules and derived-stat formulas live.
- **`src/io/`** — Persistence (`Storage.ts`, IndexedDB via localforage) and content loading
  (`ContentLoader.ts`, which reads `content/*.json` into typed collections).
- **`src/features/`** — Vertical-slice UI modules: `character_builder`, `character_sheet`,
  `compendium`, `main_menu`. Each owns its own routes and components. Feature modules may read
  from `src/classes/` and `src/io/`, but should not reach into each other's internals directly.
- **`src/ui/`** — Shared, generic components with no knowledge of game-specific state or
  feature stores.
- **`src/stores/`** — Only truly global Pinia stores (e.g. navigation). Feature-specific state
  lives inside that feature's own folder, not here.

## Conventions

- Serialization symmetry: anything that implements `ISerializable` must be reconstructible
  from what it serializes (`Character.Deserialize(character.Serialize())` round-trips cleanly).
- Content vs. code: rules content (Lifepath tables, equipment, talents, spells) lives in
  `content/` as data, not hardcoded into components — the Lifepath wizard, for example, is a
  generic renderer over `content/lifepath/*.json`, not six hand-built pages.
- Dice mechanics are out of scope for this app; that's handled by a separate project.
