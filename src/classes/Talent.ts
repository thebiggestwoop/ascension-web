import type { AttributeId, SkillId, TalentCategory, TalentTier } from './enums'

export interface ITalentPrerequisite {
  attribute?: { id: AttributeId; minRating: number }
  /** OR across attributes, e.g. Gauntlet Adept's "Agility, Brawn, or Coordination 10". */
  attributeAny?: { ids: AttributeId[]; minRating: number }
  skill?: { id: SkillId; minRating: number }
  /** Name of a Trait the character must hold, e.g. "Noble" or "Spellcaster". */
  trait?: string
  /** References a content/lifepath/careers.json option id, e.g. "acolyte". */
  career?: string
  magickDomain?: string
  priorTalentId?: string
  minLevel?: number
}

/** Everything about a character-in-progress needed to evaluate whether they meet a Talent's prerequisites. */
export interface ITalentPrereqContext {
  attributes: Record<AttributeId, number>
  skills: Record<SkillId, number>
  /** Names of Traits the character currently holds. */
  traitNames: Set<string>
  careerId?: string
  /** Magick domains ('arcane'/'light'/'dark') the character currently has access to via a Magick Domain talent. */
  magickDomains: Set<string>
  /** Talent ids the character currently has (for priorTalentId chains). */
  talentIds: Set<string>
  level: number
}

/** Pure prerequisite check shared by the builder's Talent picker and the Compendium browser. */
export function meetsTalentPrerequisites(prereq: ITalentPrerequisite, ctx: ITalentPrereqContext): boolean {
  if (prereq.attribute && ctx.attributes[prereq.attribute.id] < prereq.attribute.minRating) return false
  if (prereq.attributeAny && !prereq.attributeAny.ids.some((id) => ctx.attributes[id] >= prereq.attributeAny!.minRating))
    return false
  if (prereq.skill && ctx.skills[prereq.skill.id] < prereq.skill.minRating) return false
  if (prereq.trait && !ctx.traitNames.has(prereq.trait)) return false
  if (prereq.career && ctx.careerId !== prereq.career) return false
  if (prereq.magickDomain && !ctx.magickDomains.has(prereq.magickDomain)) return false
  if (prereq.priorTalentId && !ctx.talentIds.has(prereq.priorTalentId)) return false
  if (prereq.minLevel && ctx.level < prereq.minLevel) return false
  return true
}

/**
 * Unconditional (always-on while held) numeric bonuses to a derived stat, e.g. Resilient 1's
 * "Your Health Bar increases by 2". Only set on abilities whose bonus applies regardless of
 * combat state/stance - situational bonuses (e.g. "+2 Speed while berserk") stay text-only in
 * effectText, since the app doesn't track battle-turn state to know when they'd apply.
 */
export interface ITalentPassiveModifiers {
  /** Adds to Health Bar before the x3 Max HP multiplier. */
  healthBarBonus?: number
  /** Adds directly to Max Willpower. */
  willpowerBonus?: number
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
  passiveModifiers?: ITalentPassiveModifiers
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
  /** One-sentence rules-text blurb introducing the Archetype/Talent Tree, e.g. "You're a fighter,
   * first and foremost, and know how to apply your skills on and off the battlefield." */
  flavorText?: string
  /** True once this group's abilities have been fully transcribed into ITalentData entries. */
  transcribed: boolean
}
