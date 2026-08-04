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
  /** The two Skills chosen as "Combat Focuses" (Chapter Six's optional rule). */
  combatSkillFocuses: SkillId[]
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
  /** The two Skills chosen as "Combat Focuses" (Chapter Six's optional rule). */
  combatSkillFocuses: SkillId[]
}

/** Focuses/Values/Traits chosen by hand, matching Quick Build's own such fields - used both by
 * Quick Build itself and by the Archetype path's "Quick Entry" option. */
export interface IFocusValueTraitEntry {
  focusTexts: string[]
  valueTexts: string[]
  traitNames: string[]
  definingFeatureText: string
}

/** The Archetype path's Step Three ("Finishing Touches"): the same shape as Quick Build's own
 * grants, minus Focuses/Values/Traits - those were already applied in Step Two, by whichever of
 * Lifepath or Quick Entry the player chose (see ICreationRecord.archetype below). */
export interface IArchetypeFinishingTouchesRecord {
  attributes: Record<AttributeId, number>
  skills: Record<SkillId, number>
  narrativeTalentIds: string[]
  combatTalentIds: string[]
  equippedWeaponIds: string[]
  equippedArmorId?: string
  inventoryItemIds: string[]
  mountId?: string
  preparedSpellIds: string[]
  combatSkillFocuses: SkillId[]
}

/** The "Start from an Archetype" path's full record: which pregen it started from, how
 * Focuses/Values/Traits were chosen (Lifepath's own stages, minus Attribute/Skill grants - see
 * `lifepathSelections` below - or Quick Entry's flat form), and the final Finishing Touches
 * grants (Attributes/Skills/Talents/Equipment/Spells), pre-filled from the Archetype but
 * editable before finishing. */
export interface IArchetypeCreationRecord {
  archetypeId: string
  focusValueTraitMethod: 'lifepath' | 'quick_entry'
  quickEntry?: IFocusValueTraitEntry
  finishingTouches: IArchetypeFinishingTouchesRecord
}

/** Every choice made while building this character, whichever of the three creation paths was used. */
export interface ICreationRecord {
  method: 'lifepath' | 'quick_build' | 'archetype'
  /** One entry per Lifepath stage (Social Class through Life Events), in the order completed -
   * for `method: 'archetype'` with `archetype.focusValueTraitMethod === 'lifepath'`, these
   * carry empty resolvedAttributePoints/resolvedSkillPoints throughout (see
   * LifepathStageStep's `skipAttributeSkillGrants`), since the Archetype's own Attributes/
   * Skills aren't touched by that sub-flow. */
  lifepathSelections?: ILifepathSelection[]
  finishingTouches?: IFinishingTouchesRecord
  quickBuild?: IQuickBuildRecord
  archetype?: IArchetypeCreationRecord
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
  /** Granted only at Advancement's `thirdCombatFocusUnlockLevel` (Level 6) - the new third
   * Combat Focus Skill, additive to whichever two (or three, post-reassign) are already held. */
  thirdCombatFocusSkillId?: SkillId
  /** "Instead, You May Also... Reassign which Skills your Combat Focuses are in" - the full
   * replacement set (same count as currently held), applied before any thirdCombatFocusSkillId
   * grant from this same level-up is appended on top. */
  reassignedCombatSkillFocuses?: SkillId[]
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
  /** combatSkillFocuses immediately before this level-up - restored verbatim on revert, the same
   * "snapshot and restore" approach as previousCurrentHp/previousCurrentWillpower, since this one
   * field can change via either the mandatory Level 6 grant or the reassign respec (or both).
   * Optional since level-ups recorded before this field existed won't have it. */
  previousCombatSkillFocuses?: SkillId[]
}
