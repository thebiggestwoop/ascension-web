import type { AttributeId, SkillId } from './enums'

/** Every NPC value that varies by tier is stored as [Tier 1, Tier 2, Tier 3] - the rulebook's
 * "A/B/C" notation. A value that doesn't vary repeats the same number three times. */
export type Tiered = [number, number, number]
export type NpcTier = 1 | 2 | 3

export type NpcCategory = 'standard' | 'chaff' | 'monumental'

/**
 * How an NPC number is derived, using the same rules as Player Characters ("If an Attribute
 * or Skill of an NPC is altered, it should alter the derived statistics appropriately"):
 *
 *   value = base + Attribute (or half Attribute, rounded down) + Skill
 *
 * e.g. an attack's Target is Attribute + Skill (base 0), weapon damage is the weapon's [CD]
 * + Skirmish, HP is Brawn + 0/2/4, Speed is 3 + half Agility. `base` was solved from the
 * printed rulebook value, so every formula reproduces the stat block exactly; a tiered base
 * marks a value that doesn't follow the rule cleanly.
 */
export interface INpcFormula {
  base: number | Tiered
  attribute?: AttributeId
  halfAttribute?: boolean
  skill?: SkillId
  /** Colossus only: which body part's Attributes the formula reads. */
  part?: 'head' | 'torso' | 'legs'
  /** Gauntlet attacks that may use any of these Attributes (all equal on the stat block). */
  attributeOptions?: AttributeId[]
  /** Mounted/flying speed formulas: the mount whose base Speed `base` comes from. */
  mount?: string
}

export type NpcComputedStat =
  | 'target'
  | 'damage'
  | 'willpowerDamage'
  | 'healing'
  | 'willpowerRestored'
  | 'range'
  | 'speed'

/** A number inside an entry's `text` that's derived from the NPC's Attributes/Skills -
 * mirrors ISpellComputedValue. `matchText` is the exact substring to replace. */
export interface INpcComputedValue extends INpcFormula {
  matchText: string
  stat: NpcComputedStat
}

/** Formulas for the stat-line values (not present on the Colossus's per-part HP/Speed). */
export interface INpcDerivedStats {
  hp?: INpcFormula
  willpower?: INpcFormula
  speed?: INpcFormula
  mountedSpeed?: INpcFormula
  /** half Attribute + base (-1), per Attribute, with per-Attribute base overrides where the
   * printed save doesn't follow the rule. */
  effectSaves?: INpcFormula & { overrides?: Partial<Record<AttributeId, { base: number | Tiered }>> }
}

/** One line of an NPC stat block: an attack, action, or feature. `text` is the rulebook
 * wording verbatim (everything after the name/tags), tier values still in A/B/C form. */
export interface INpcEntry {
  name: string
  tags?: string[]
  /** "Recharges [!]" - stripped out of `tags` into this flag. */
  recharge?: boolean
  text: string
  /** A feature that grants an attack (e.g. Javelin Throw -> Javelin) carries it here. */
  attack?: INpcEntry
  computed?: INpcComputedValue[]
  /** Stat changes applied when this feature/template is chosen in the NPC Builder. */
  statModifiers?: INpcStatModifiers
}

/** Mechanical effect of an optional feature or template on the stat line. */
export interface INpcStatModifiers {
  resistanceBonus?: number
  /** "The X has 2 Resistance" - Resistance becomes at least this. */
  resistanceMinimum?: number
  willpowerBonus?: number
  speedBonus?: number
  /** Sets the number of Health Bars (Veteran 2, Elite 3). */
  healthBars?: number
  hpPerHealthBar?: number
  size?: number
  /** Flying Speed = walking Speed + this (Monstrosity's Flight). */
  flyingSpeedOffset?: number
  /** Griffin Rider: Flying Speed comes from this entry's own `speed` computed value. */
  flying?: boolean
  replacesMountedSpeed?: boolean
}

/** The Colossus's Head/Torso/Legs each have their own Attributes, Effect Saves and Resistance. */
export interface INpcBodyPart {
  attributes: Record<AttributeId, Tiered>
  effectSaves: Record<AttributeId, Tiered>
  resistance: number
}

export interface INpcData {
  id: string
  name: string
  category: NpcCategory
  /** The stat block's written "Type:" - absent on Monumental Foes, which have none. */
  type?: string
  /** The NPC Type (see types.json) its stat-block heading is colour-coded as. */
  colorType: string | null
  tags: string[]
  description: string
  attributes?: Record<AttributeId, Tiered>
  /** Chaff stat blocks have no Effect Saves. */
  effectSaves?: Record<AttributeId, Tiered>
  parts?: Record<'head' | 'torso' | 'legs', INpcBodyPart>
  skills: Record<SkillId, Tiered>
  /** Monumental Foes only. */
  morale?: number
  /** null for the Colossus, which has no Willpower. */
  willpower: Tiered | null
  /** Absent only when Resistance is per body part (Colossus). */
  resistance?: number
  hp: Tiered
  healthBars: number
  speed: Tiered
  mountedSpeed?: Tiered
  flyingSpeed?: Tiered
  special?: string
  /** e.g. "The Elementalist knows 1-3 of these spells:" - qualifies the attacks list. */
  attacksNote?: string
  features?: INpcEntry[]
  attacks?: INpcEntry[]
  groupAttacks?: INpcEntry[]
  divisionAttacks?: INpcEntry[]
  actions?: INpcEntry[]
  minorActions?: INpcEntry[]
  optionalFeatures?: INpcEntry[]
  optionalMajorFeatures?: INpcEntry[]
  derived?: INpcDerivedStats
  /** Spaces per side - only set by features like Massive/Bulky Armor (default 1). */
  size?: number
  transcribed: boolean
}

/** One entry of the colour-coded NPC Types legend (plus bespoke types like Monstrosity). */
export interface INpcTypeData {
  id: string
  name: string
  /** Hex highlight colour the rulebook uses for this type. */
  color: string
  description: string
}

export interface INpcTemplateData {
  id: string
  name: string
  description: string
  features: INpcEntry[]
  optionalFeatures: INpcEntry[]
  /** How many enemies this counts as for encounter balance, where the rules state it. */
  encounterWeight?: number
  massCombatOnly?: boolean
}

export interface INpcTemplatesFile {
  tiers: { notation: string; tiers: { tier: NpcTier; levels: string }[] }
  templates: INpcTemplateData[]
  rules: {
    chaff: { name: string; text: string; groupHealth: string; groupActions: string }
    monumentalFoe: { name: string; encounterWeight: number; text: string; attributesAndSkills: string; health: string }
  }
}

function tierValue(value: number | Tiered, tier: NpcTier): number {
  return typeof value === 'number' ? value : value[tier - 1]
}

/** Evaluates a formula against an NPC's own Attributes/Skills at one tier. */
export function computeNpcFormula(npc: INpcData, formula: INpcFormula, tier: NpcTier): number {
  let total = tierValue(formula.base, tier)
  if (formula.attribute) {
    const attributes = formula.part ? npc.parts?.[formula.part].attributes : npc.attributes
    const a = attributes ? attributes[formula.attribute][tier - 1] : 0
    total += formula.halfAttribute ? Math.floor(a / 2) : a
  }
  if (formula.skill) total += npc.skills[formula.skill][tier - 1]
  return total
}

/** Resolves a tiered value for one tier, or the rulebook's "A/B/C" form when tier is null
 * (collapsed to a single number when all three tiers are equal). */
export function formatTiered(value: Tiered, tier: NpcTier | null): string {
  if (tier) return String(value[tier - 1])
  return value[0] === value[1] && value[1] === value[2] ? String(value[0]) : value.join('/')
}

/** Replaces every "A/B/C" tier triple in rules text with the chosen tier's number. Only
 * exact three-number groups are touched, so e.g. "1/round" or "Agility/Brawn" pass through. */
export function resolveTierText(text: string, tier: NpcTier | null): string {
  if (!tier) return text
  return text.replace(/\b(\d+)\/(\d+)\/(\d+)\b/g, (_m, a: string, b: string, c: string) => [a, b, c][tier - 1])
}
