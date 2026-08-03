import type { AttributeId, SkillId } from './enums'
import type { ILifepathSelection } from './Lifepath'

/**
 * Step Six: Finishing Touches' net grants, as resolved by the wizard (cap-correction
 * reductions + freely-reallocated pool + bonus points already folded into the deltas).
 * Recorded verbatim as part of a character's creation history.
 */
export interface IFinishingTouchesRecord {
  attributeDeltas: Partial<Record<AttributeId, number>>
  skillDeltas: Partial<Record<SkillId, number>>
  valueText: string
  definingFeatureText: string
  narrativeTalentIds: string[]
  combatTalentIds: string[]
  equippedWeaponIds: string[]
  equippedArmorId?: string
  inventoryItemIds: string[]
  mountId?: string
  preparedSpellIds: string[]
}

/** Quick Build's one-shot grants, recorded verbatim as part of a character's creation history. */
export interface IQuickBuildRecord {
  attributes: Record<AttributeId, number>
  skills: Record<SkillId, number>
  focusTexts: string[]
  valueTexts: string[]
  /** Traits granted by the chosen Social Class (e.g. Peasant -> ["Commoner", "Peasant"], Noble -> ["Noble"]). */
  traitNames: string[]
  definingFeatureText: string
  narrativeTalentIds: string[]
  combatTalentIds: string[]
  equippedWeaponIds: string[]
  equippedArmorId?: string
  inventoryItemIds: string[]
  mountId?: string
  preparedSpellIds: string[]
}

/** Every choice made while building this character, whichever of the two creation paths was used. */
export interface ICreationRecord {
  method: 'lifepath' | 'quick_build'
  /** One entry per Lifepath stage (Social Class through Life Events), in the order completed. */
  lifepathSelections?: ILifepathSelection[]
  finishingTouches?: IFinishingTouchesRecord
  quickBuild?: IQuickBuildRecord
}

/** The choices a player makes in the Level Up dialog - both the chart's normal grants and any
 * "Instead, You May Also" respec picks. Shared between the dialog's emitted payload and the
 * persisted history record (the record additionally carries the level reached and enough prior
 * state to revert exactly). */
export interface ILevelUpChoices {
  attributeDeltas: Partial<Record<AttributeId, number>>
  skillDeltas: Partial<Record<SkillId, number>>
  focusText?: string
  narrativeTalentIds: string[]
  combatTalentIds: string[]
  removeTalentIds?: string[]
  removeFocusText?: string
  replacementFocusText?: string
}

/** One completed Level Up, everything needed to walk it back exactly. */
export interface ILevelUpRecord extends ILevelUpChoices {
  /** The level ascended TO by this record. */
  level: number
  /** currentHp/currentWillpower immediately before this level-up - restored verbatim on revert
   * rather than recomputed, since recomputing against the reverted max could differ from what
   * the player actually had. */
  previousCurrentHp: number
  previousCurrentWillpower: number
  /** Traits granted as a side effect of this level-up's Talent picks (e.g. "Spellcaster" from
   * newly taking a Tier 1 Magick Domain Talent) - removed again if this level-up is reverted. */
  grantedTraitNames?: string[]
}
