export interface ILevelAscensionRow {
  level: number
  combatTalents: number
  narrativeTalents: number
  attributePoints: number
  skillPoints: number
  newFocus: boolean
  /** Rules text for a level that unlocks something beyond its normal grants (e.g. Tier 3 Talents). */
  unlocks?: string
}

export interface IExperiencePointsRow {
  xp: number
  description: string
}

/** Chapter Two's Character Advancement rules: leveling 0-12 via milestones or session XP. */
export interface IAdvancementData {
  startingLevel: number
  maxLevel: number
  xpThresholdPerLevel: number
  tier3TalentUnlockLevel: number
  /** Level at which the higher Attribute 12 / Skill 5 maximum unlocks (only one Attribute/Skill
   * may ever reach it). Below this level the maximum is 11/4, but - past character creation -
   * any number of Attributes/Skills may sit at 11/4; only this higher cap is single-owner. */
  attributeSkillMaxUnlockLevel: number
  /** "Focuses in Combat" optional rule: a third Combat Skill Focus may be chosen at this level. */
  thirdCombatFocusUnlockLevel: number
  levelAscensionChart: ILevelAscensionRow[]
  experiencePoints: IExperiencePointsRow[]
  /** On level-up, in addition to the chart's grants, a character may also do one of these. */
  respecOptions: string[]
}
