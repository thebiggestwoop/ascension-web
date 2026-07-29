import type { AttributeId, SkillId, SocialClassId, TalentCategory, TalentTier } from './enums'

export interface ITalentPrerequisite {
  attribute?: { id: AttributeId; minRating: number }
  /** OR across attributes, e.g. Gauntlet Adept's "Agility, Brawn, or Coordination 10". */
  attributeAny?: { ids: AttributeId[]; minRating: number }
  skill?: { id: SkillId; minRating: number }
  socialClass?: SocialClassId
  /** References a content/lifepath/careers.json option id, e.g. "acolyte". */
  career?: string
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

/**
 * A lightweight table-of-contents entry for an Archetype (narrative) or Talent Tree
 * (combat) that hasn't had its individual abilities transcribed into ITalentData yet.
 * Lets the full group list (all 15 Archetypes, all 49 Talent Trees) be tracked and
 * rendered as "coming soon" before the full rules text is entered.
 */
export interface ITalentGroupIndexEntry {
  id: string
  name: string
  category: TalentCategory
  /** e.g. "Skill Archetype" / "Class Archetype" / "Setting Archetype" / "Magickal Archetype"
   * for narrative groups, or "Weapon Adept" / "General" / "Magick" for combat trees. */
  subgroup: string
  /** Raw prerequisite text as printed in the rules (e.g. "Requires Agility 10"). */
  prerequisiteText: string
  /** True once this group's abilities have been fully transcribed into ITalentData entries. */
  transcribed: boolean
}
