export type MagickDomain = 'arcane' | 'light' | 'dark'
export type ActionType = 'major' | 'minor' | 'reaction' | 'passive'

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
