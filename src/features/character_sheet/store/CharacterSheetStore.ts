import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import type { AttributeId, SkillId } from '@/classes/enums'
import type { ICharacterData } from '@/classes/Character'
import { Character, computeStatModifiers } from '@/classes/Character'
import { CoreContent } from '@/io/ContentLoader'
import { loadCharacter, saveCharacter } from '@/io/Storage'

export interface ILevelUpPayload {
  attributeDeltas: Partial<Record<AttributeId, number>>
  skillDeltas: Partial<Record<SkillId, number>>
  focusText?: string
  narrativeTalentIds: string[]
  combatTalentIds: string[]
}

export const useCharacterSheetStore = defineStore('characterSheet', {
  state: () => ({
    character: null as ICharacterData | null,
    loading: false,
    notFound: false,
  }),
  actions: {
    async loadById(id: string) {
      this.loading = true
      this.notFound = false
      const data = await loadCharacter(id)
      this.character = data
      this.notFound = data === null
      this.loading = false
    },
    async persist() {
      if (!this.character) return
      await saveCharacter(this.character.id, toRaw(this.character))
    },
    async adjustHp(delta: number, max: number) {
      if (!this.character) return
      this.character.currentHp = Math.max(0, Math.min(max, this.character.currentHp + delta))
      await this.persist()
    },
    async adjustWillpower(delta: number, max: number) {
      if (!this.character) return
      this.character.currentWillpower = Math.max(0, Math.min(max, this.character.currentWillpower + delta))
      await this.persist()
    },
    async toggleValueActive(index: number) {
      if (!this.character) return
      const value = this.character.values[index]
      if (!value) return
      value.active = !value.active
      await this.persist()
    },
    async adjustXp(delta: number) {
      if (!this.character) return
      this.character.xp = Math.max(0, this.character.xp + delta)
      await this.persist()
    },
    /** Applies one Level Ascension Chart entry's grants and refills HP/Willpower to the new max. */
    async levelUp(payload: ILevelUpPayload) {
      if (!this.character) return
      this.character.level += 1
      for (const [id, amount] of Object.entries(payload.attributeDeltas)) {
        this.character.attributes[id as AttributeId] += amount ?? 0
      }
      for (const [id, amount] of Object.entries(payload.skillDeltas)) {
        this.character.skills[id as SkillId] += amount ?? 0
      }
      if (payload.focusText) this.character.focuses.push(payload.focusText)
      this.character.talentIds.push(...payload.narrativeTalentIds, ...payload.combatTalentIds)

      const modifiers = computeStatModifiers(
        toRaw(this.character),
        [...CoreContent.talents.narrative, ...CoreContent.talents.combat],
        CoreContent.equipment.armor,
        CoreContent.equipment.general,
      )
      const char = Character.Deserialize(toRaw(this.character), modifiers)
      this.character.currentHp = char.maxHp
      this.character.currentWillpower = char.maxWillpower

      await this.persist()
    },
  },
})
