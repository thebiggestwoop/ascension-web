import type { AttributeId, SkillId, SocialClassId, TalentCategory, TalentTier } from './enums'

export interface ITalentPrerequisite {
  attribute?: { id: AttributeId; minRating: number }
  skill?: { id: SkillId; minRating: number }
  socialClass?: SocialClassId
  magickDomain?: string
  priorTalentId?: string
  minLevel?: number
}

/**
 * A single named ability. Narrative Talents are flat lists grouped under an
 * Archetype; Combat Talents are ordered within a Tier 1-3 Talent Tree.
 */
export interface ITalentData {
  id: string
  name: string
  category: TalentCategory
  /** Archetype name (narrative) or Talent Tree name (combat). */
  group: string
  tier?: TalentTier
  prerequisites: ITalentPrerequisite
  effectText: string
}
