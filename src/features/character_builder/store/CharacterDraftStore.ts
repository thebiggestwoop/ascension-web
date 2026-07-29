import { defineStore } from 'pinia'
import { AttributeId, SkillId } from '@/classes/enums'
import type { ICharacterData } from '@/classes/Character'
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
    reset() {
      this.draft = createBaseDraft()
      this.completedStageIds = []
    },
  },
})
