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
}

/**
 * Applies a resolved Lifepath selection's grants onto a draft character-in-progress.
 * The builder wizard calls this once per stage as the player completes it; final caps
 * (Attribute <= 11 with only one exception, Skill <= 4 with only one exception, sums of
 * 56/14) are validated separately at the Finishing Touches step, not here.
 */
export function applyLifepathSelection(
  draft: Pick<ICharacterData, 'attributes' | 'skills' | 'focuses' | 'values' | 'traits'>,
  selection: ILifepathSelection,
  stage: ILifepathStageData,
): void {
  const option = stage.options.find((o) => o.id === selection.optionId)
  if (!option) {
    throw new Error(`Unknown Lifepath option "${selection.optionId}" for stage "${stage.id}"`)
  }

  for (const [id, amount] of Object.entries(selection.resolvedAttributePoints)) {
    draft.attributes[id as AttributeId] += amount ?? 0
  }
  for (const [id, amount] of Object.entries(selection.resolvedSkillPoints)) {
    draft.skills[id as SkillId] += amount ?? 0
  }

  draft.focuses.push(...selection.focusText)

  if (option.grants.valuePrompt && selection.valueText) {
    const value: IValue = { text: selection.valueText, active: true }
    draft.values.push(value)
  }

  if (option.grants.trait) {
    draft.traits.push({ name: option.grants.trait })
  }
}
