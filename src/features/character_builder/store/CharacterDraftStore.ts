import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { AttributeId, SkillId } from '@/classes/enums'
import type { ICharacterData } from '@/classes/Character'
import { Character } from '@/classes/Character'
import type { ILifepathSelection, ILifepathStageData } from '@/classes/Lifepath'
import { applyLifepathSelection } from '@/classes/Lifepath'

/** Every character begins at Attributes=6, Skills=1 per Chapter Two. */
function createBaseDraft(): ICharacterData {
  return {
    name: '',
    level: 0,
    xp: 0,
    attributes: {
      [AttributeId.Agility]: 6,
      [AttributeId.Awareness]: 6,
      [AttributeId.Brawn]: 6,
      [AttributeId.Coordination]: 6,
      [AttributeId.Faith]: 6,
      [AttributeId.Presence]: 6,
      [AttributeId.Reason]: 6,
    },
    skills: {
      [SkillId.Skirmish]: 1,
      [SkillId.Authority]: 1,
      [SkillId.Diplomacy]: 1,
      [SkillId.Study]: 1,
      [SkillId.Medicine]: 1,
      [SkillId.Intrigue]: 1,
    },
    focuses: [],
    values: [],
    traits: [],
    currentHp: 0,
    currentWillpower: 0,
    temporaryHp: 0,
    statuses: [],
    determination: 0,
    talentIds: [],
    equippedWeaponIds: [],
    inventoryItemIds: [],
  }
}

/**
 * Step Six: Finishing Touches doesn't go through applyLifepathSelection() since it isn't
 * option-driven - the wizard resolves cap correction, bonus points, Value/Trait/Talent/
 * Equipment picks itself and hands the net result here as one batch.
 */
export interface IFinishingTouchesPayload {
  /** Net Attribute deltas: cap-correction reductions + freely-reallocated pool + bonus points. */
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
}

export const useCharacterDraftStore = defineStore('characterDraft', {
  state: () => ({
    draft: createBaseDraft(),
    completedStageIds: [] as string[],
  }),
  actions: {
    applyStage(stage: ILifepathStageData, selection: ILifepathSelection) {
      applyLifepathSelection(this.draft, selection, stage)
      this.completedStageIds.push(stage.id)
    },
    applyFinishingTouches(payload: IFinishingTouchesPayload) {
      for (const [id, amount] of Object.entries(payload.attributeDeltas)) {
        this.draft.attributes[id as AttributeId] += amount ?? 0
      }
      for (const [id, amount] of Object.entries(payload.skillDeltas)) {
        this.draft.skills[id as SkillId] += amount ?? 0
      }
      this.draft.values.push({ text: payload.valueText, active: true })
      this.draft.traits.push({ name: payload.definingFeatureText })
      this.draft.talentIds.push(...payload.narrativeTalentIds, ...payload.combatTalentIds)
      this.draft.equippedWeaponIds.push(...payload.equippedWeaponIds)
      if (payload.equippedArmorId) this.draft.equippedArmorId = payload.equippedArmorId
      this.draft.inventoryItemIds.push(...payload.inventoryItemIds)
      if (payload.mountId) this.draft.mountId = payload.mountId

      // Character is now playable: start at full HP/Willpower.
      // toRaw() unwraps Pinia's reactive Proxy - structuredClone() (used inside
      // Character.Deserialize) can't clone a live reactive Proxy directly.
      const char = Character.Deserialize(toRaw(this.draft))
      this.draft.currentHp = char.maxHp
      this.draft.currentWillpower = char.maxWillpower

      this.completedStageIds.push('finishing_touches')
    },
    reset() {
      this.draft = createBaseDraft()
      this.completedStageIds = []
    },
  },
})
