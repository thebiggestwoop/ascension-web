import type { AttributeId, SkillId } from './enums'
import { LifepathStageId } from './enums'
import type { ICharacterData, IValue } from './Character'

/** One point to allocate. If `restrictTo` is omitted the player picks freely from all 7/6. */
export interface IAttributePointGrant {
  amount: number
  restrictTo?: AttributeId[]
}

export interface ISkillPointGrant {
  amount: number
  restrictTo?: SkillId[]
}

export interface ILifepathGrants {
  attributePoints: IAttributePointGrant[]
  skillPoints: ISkillPointGrant[]
  /** Number of new Focuses this option grants; freeform text chosen by the player. */
  focusCount: number
  focusExamples?: string[]
  /** Prompt text shown to the player if this option grants a Value. */
  valuePrompt?: string
  trait?: string
  /** A second, more specific Trait granted alongside `trait` - e.g. Social Class's general
   * "Noble"/"Commoner" Trait plus the specific rank ("Petty Nobility", "Peasant", etc.). */
  additionalTrait?: string
}

export interface ILifepathOption {
  id: string
  name: string
  description: string
  grants: ILifepathGrants
}

/** One of the six Lifepath stages (Social Class, Upbringing, Education, Career, Life Events, Finishing Touches). */
export interface ILifepathStageData {
  id: LifepathStageId
  name: string
  /** How many options the player selects at this stage (Life Events defaults to 2). */
  selectCount: number
  options: ILifepathOption[]
  /** Freeform descriptive text for this stage, independent of the chosen option. */
  notes?: string
  /** An optional checkbox at this stage that grants an extra Trait if the player opts in,
   * e.g. Upbringing's "Born out of wedlock" -> "Illegitimate". */
  optionalTrait?: { label: string; trait: string }
}

/** A choice made by the player while stepping through the wizard, not yet applied to a Character. */
export interface ILifepathSelection {
  stageId: LifepathStageId
  optionId: string
  /** Player's resolution of any free choices (which attribute/skill got the point, focus text, value text). */
  resolvedAttributePoints: Partial<Record<AttributeId, number>>
  resolvedSkillPoints: Partial<Record<SkillId, number>>
  focusText: string[]
  valueText?: string
  /** Whether the player opted into the stage's `optionalTrait` (e.g. "Born out of wedlock"). */
  optionalTraitGranted?: boolean
}

/**
 * Stages whose chosen option auto-grants a "{Label}: {option name}" Trait, e.g. Upbringing's
 * "Upbringing: Agrarian". Social Class instead uses its options' explicit `trait`/
 * `additionalTrait` fields (a general Noble/Commoner Trait plus a specific rank), since
 * "Social Class: X" wouldn't read naturally and it already needs two distinct Trait names.
 */
export const AUTO_TRAIT_STAGE_LABEL: Partial<Record<LifepathStageId, string>> = {
  [LifepathStageId.Upbringing]: 'Upbringing',
  [LifepathStageId.Education]: 'Education',
  [LifepathStageId.Career]: 'Career',
  [LifepathStageId.LifeEvents]: 'Life Event',
}

/**
 * Step Six: Finishing Touches is not option-driven like the other five stages — it's a
 * fixed sequence of cap-correction passes, bonus points, and grants, ending in the Final
 * Scores checkpoint that the whole build must satisfy.
 */
export interface IFinishingTouchesData {
  id: 'finishing_touches'
  name: string
  attributeCap: { max: number; maxAtCap: number }
  attributeBonusCount: number
  skillCap: { max: number; maxAtCap: number }
  skillBonusCount: number
  bonusValueCount: number
  combatTalentGrant: { tier: number; count: number }
  narrativeTalentGrant: number
  definingFeatureTrait: true
  equipmentGrant: string
  finalCheck: {
    attributeSum: number
    skillSum: number
    combatTalentTier1Count: number
    narrativeTalentCount: number
    focusCount: number
    valueCount: number
  }
}

/** The fast-path alternative to the six-step Lifepath: assign from fixed arrays instead. */
export interface IStandardArrayData {
  attributeArray: number[]
  attributeBonusPoints: number
  skillArray: number[]
  skillBonusPoints: number
  focusCount: number
  valueCount: number
  combatTalentGrant: { tier: number; count: number }
  narrativeTalentGrant: number
  startingTraits: string[]
  finalCheck: { attributeSum: number; skillSum: number }
}

/**
 * Applies a resolved Lifepath selection's grants onto a draft character-in-progress.
 * The builder wizard calls this once per stage as the player completes it; final caps
 * (Attribute <= 11 with only one exception, Skill <= 4 with only one exception, sums of
 * 56/14) are validated separately at the Finishing Touches step, not here.
 */
export function applyLifepathSelection(
  draft: Pick<ICharacterData, 'attributes' | 'skills' | 'focuses' | 'values' | 'traits' | 'careerId'>,
  selection: ILifepathSelection,
  stage: ILifepathStageData,
): void {
  const option = stage.options.find((o) => o.id === selection.optionId)
  if (!option) {
    throw new Error(`Unknown Lifepath option "${selection.optionId}" for stage "${stage.id}"`)
  }

  if (stage.id === LifepathStageId.Career) draft.careerId = option.id

  for (const [id, amount] of Object.entries(selection.resolvedAttributePoints)) {
    draft.attributes[id as AttributeId] += amount ?? 0
  }
  for (const [id, amount] of Object.entries(selection.resolvedSkillPoints)) {
    draft.skills[id as SkillId] += amount ?? 0
  }

  draft.focuses.push(...selection.focusText)

  if (option.grants.valuePrompt && selection.valueText) {
    const value: IValue = { text: selection.valueText, active: true, challenged: false }
    draft.values.push(value)
  }

  if (option.grants.trait) {
    draft.traits.push({ name: option.grants.trait })
  }
  if (option.grants.additionalTrait) {
    draft.traits.push({ name: option.grants.additionalTrait })
  }

  const autoLabel = AUTO_TRAIT_STAGE_LABEL[stage.id]
  if (autoLabel) {
    draft.traits.push({ name: `${autoLabel}: ${option.name}` })
  }

  if (selection.optionalTraitGranted && stage.optionalTrait) {
    draft.traits.push({ name: stage.optionalTrait.trait })
  }
}
