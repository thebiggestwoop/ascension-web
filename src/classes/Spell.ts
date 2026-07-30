import { AttributeId } from './enums'

export type MagickDomain = 'arcane' | 'light' | 'dark'
export type ActionType = 'major' | 'minor' | 'reaction' | 'passive'

/** Magick Attribute used for a domain's Spell Attacks/tasks, per Chapter Eight. */
export const MAGICK_ATTRIBUTE_BY_DOMAIN: Record<MagickDomain, AttributeId> = {
  arcane: AttributeId.Reason,
  light: AttributeId.Faith,
  dark: AttributeId.Presence,
}

/**
 * A number in a spell's effectText that's actually determined by the caster - e.g.
 * Penumbra's "2[CD]" base damage, which per Chapter Eight also gains the caster's Skirmish
 * (Spell Attack damage) and scales further per Wound. Only annotated for spells with an
 * unambiguous plain "N[CD]" damage clause (no other Skill already baked into the printed
 * number, e.g. Castigate's "2 + Diplomacy [CD]" is deliberately left alone - whether Skirmish
 * additionally stacks on top of a skill-composite formula isn't stated in the source text).
 */
export interface ISpellComputedValue {
  /** Exact substring in effectText to replace with the live total (first occurrence only,
   * so a later plain-text mention of the same number - e.g. describing "increases by 2[CD]
   * per Wound" - is left as rule-text, not re-substituted). */
  matchText: string
  /** Base number as printed, before any Skirmish/Wound additions. */
  base: number
  /** Adds the caster's Skirmish - true for full Spell Attacks; a Spellblade's flat weapon-
   * damage bonus omits this since the weapon's own damage already includes Skirmish once. */
  addsSkirmish?: boolean
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
