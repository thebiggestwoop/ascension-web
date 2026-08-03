import { AttributeId, SkillId } from './enums'

export type MagickDomain = 'arcane' | 'light' | 'dark'
export type ActionType = 'major' | 'minor' | 'reaction' | 'passive'

/** Magick Attribute used for a domain's Spell Attacks/tasks, per Chapter Eight. */
export const MAGICK_ATTRIBUTE_BY_DOMAIN: Record<MagickDomain, AttributeId> = {
  arcane: AttributeId.Reason,
  light: AttributeId.Faith,
  dark: AttributeId.Presence,
}

/**
 * The Skill paired with the caster's Magick Attribute for a spell's task, if it has one at
 * all - most Attack-tagged spells use Skirmish ("Make a Spell Attack..."), but several use a
 * different Skill entirely (healing spells use Medicine, Castigate uses Diplomacy, a few
 * "Special Spell Attacks" substitute a Skill for Skirmish outright). Many spells have no task
 * at all (e.g. Touch of Haste just grants a flat bonus) - those omit this field entirely
 * rather than defaulting to Skirmish.
 */
export interface ISpellTask {
  skill: SkillId
}

/**
 * A number in a spell's effectText that's actually determined by the caster - e.g.
 * Penumbra's "2[CD]" base damage, which per Chapter Eight also gains the caster's Skirmish
 * (Spell Attack damage) and scales further per Wound; or Blood Sickness's "2 + Medicine [CD]",
 * whose printed number already bakes in Medicine (the Skill its "Special Spell Attack"
 * substitutes for Skirmish) rather than needing a separate Skirmish addition.
 */
export interface ISpellComputedValue {
  /** Exact substring in effectText to replace with the live total (first occurrence only,
   * so a later plain-text mention of the same number - e.g. describing "increases by 2[CD]
   * per Wound" - is left as rule-text, not re-substituted). */
  matchText: string
  /** Base number as printed, before any Skill/Wound additions. */
  base: number
  /** Skill added to the base - Skirmish for a standard Spell Attack's damage, or whichever
   * Skill the printed number already names (e.g. Medicine for Blood Sickness/Lay on Hands).
   * Omitted for a Spellblade's flat weapon-damage bonus, whose own weapon damage already
   * includes Skirmish once. */
  bonusSkill?: SkillId
  /** Extra amount added per Wound the caster currently has (0-2), e.g. Penumbra's +2[CD] each. */
  perWound?: number
  /** Text appended after the computed number, e.g. "[CD]". */
  suffix: string
}

/**
 * A spell's mechanical header (tier/tags/cost/action/uses) is enough to list and gate it
 * in the builder/compendium before its full rules text is transcribed. `effectText` and
 * `range` are only present once `transcribed` is true; until then this is index-only data,
 * mirroring ITalentGroupIndexEntry's "mapped but not transcribed" pattern.
 */
export interface ISpellData {
  id: string
  name: string
  domain: MagickDomain
  tier: 1 | 2 | 3
  tags: string[]
  slotCost: number
  action: ActionType
  usesPerScene: number | 'passive'
  willpowerCost?: number
  range?: string
  effectText?: string
  transcribed: boolean
  task?: ISpellTask
  computedValues?: ISpellComputedValue[]
}

export interface IMagickDomainAccess {
  domain: MagickDomain
  /** Highest Spell Tier this character can prepare from this domain. */
  maxTier: 1 | 2 | 3
}

const DOMAIN_TALENT_PREFIX: Record<MagickDomain, string> = {
  arcane: 'arcane_magick',
  light: 'light_magick',
  dark: 'dark_magick',
}

/**
 * Tier-1 Magick Domain Talent ids (Arcane/Light/Dark Magick 1) - picking any one of these
 * is what makes a character a Spellcaster, and should grant the "Spellcaster" Trait.
 */
export const SPELLCASTER_TALENT_IDS: string[] = Object.values(DOMAIN_TALENT_PREFIX).map((prefix) => `${prefix}_1`)

/**
 * Spellcasting access comes from holding a domain's Magick Domain Talent (Arcane/Light/Dark
 * Magick 1/2/3, a strict priorTalentId chain) - its tier sets the highest Spell Tier
 * preparable. Pure function of talentIds (ids are hardcoded, mirroring the same
 * DOMAIN_BY_GROUP pattern already used for Talent prerequisite/Narrative-Archetype gating),
 * so it needs no ContentLoader import.
 */
export function resolveMagickDomainAccess(talentIds: string[]): IMagickDomainAccess[] {
  const held = new Set(talentIds)
  const domains: MagickDomain[] = ['arcane', 'light', 'dark']
  const result: IMagickDomainAccess[] = []
  for (const domain of domains) {
    const prefix = DOMAIN_TALENT_PREFIX[domain]
    if (held.has(`${prefix}_3`)) result.push({ domain, maxTier: 3 })
    else if (held.has(`${prefix}_2`)) result.push({ domain, maxTier: 2 })
    else if (held.has(`${prefix}_1`)) result.push({ domain, maxTier: 1 })
  }
  return result
}
