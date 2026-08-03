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
  multipleAt11Or4UnlockLevel: number
  /** "Focuses in Combat" optional rule: a third Combat Skill Focus may be chosen at this level. */
  thirdCombatFocusUnlockLevel: number
  levelAscensionChart: ILevelAscensionRow[]
  experiencePoints: IExperiencePointsRow[]
  /** On level-up, in addition to the chart's grants, a character may also do one of these. */
  respecOptions: string[]
}
