import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import type { AttributeId, SkillId } from '@/classes/enums'
import type { ICharacterData } from '@/classes/Character'
import { Character, computeStatModifiers } from '@/classes/Character'
import type { ILevelUpChoices, ILevelUpRecord } from '@/classes/CharacterHistory'
import { CoreContent } from '@/io/ContentLoader'
import { loadCharacter, saveCharacter } from '@/io/Storage'

export type ILevelUpPayload = ILevelUpChoices

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
      // Characters saved before Level Up history was tracked won't have this field.
      if (data && !data.levelUpHistory) data.levelUpHistory = []
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
    async updateEquipment(payload: {
      equippedWeaponIds: string[]
      equippedArmorId?: string
      inventoryItemIds: string[]
      mountId?: string
    }) {
      if (!this.character) return
      this.character.equippedWeaponIds = payload.equippedWeaponIds
      this.character.equippedArmorId = payload.equippedArmorId
      this.character.inventoryItemIds = payload.inventoryItemIds
      this.character.mountId = payload.mountId
      await this.persist()
    },
    async updatePreparedSpells(preparedSpellIds: string[]) {
      if (!this.character) return
      this.character.preparedSpellIds = preparedSpellIds
      await this.persist()
    },
    /** Applies one Level Ascension Chart entry's grants and refills HP/Willpower to the new max. */
    async levelUp(payload: ILevelUpPayload) {
      if (!this.character) return
      const previousCurrentHp = this.character.currentHp
      const previousCurrentWillpower = this.character.currentWillpower

      this.character.level += 1
      for (const [id, amount] of Object.entries(payload.attributeDeltas)) {
        this.character.attributes[id as AttributeId] += amount ?? 0
      }
      for (const [id, amount] of Object.entries(payload.skillDeltas)) {
        this.character.skills[id as SkillId] += amount ?? 0
      }
      if (payload.removeTalentIds?.length) {
        this.character.talentIds = this.character.talentIds.filter((id) => !payload.removeTalentIds!.includes(id))
      }
      if (payload.removeFocusText) {
        const index = this.character.focuses.indexOf(payload.removeFocusText)
        if (index !== -1) this.character.focuses.splice(index, 1)
      }
      if (payload.replacementFocusText) this.character.focuses.push(payload.replacementFocusText)

      if (payload.focusText) this.character.focuses.push(payload.focusText)
      this.character.talentIds.push(...payload.narrativeTalentIds, ...payload.combatTalentIds)

      const record: ILevelUpRecord = { ...payload, level: this.character.level, previousCurrentHp, previousCurrentWillpower }
      this.character.levelUpHistory = [...(this.character.levelUpHistory ?? []), record]

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
    /** Walks the most recent Level Up's grants back off, restoring the exact pre-level-up
     * Attributes/Skills/Focuses/Talents/HP/Willpower recorded in that entry. */
    async revertLastLevelUp() {
      if (!this.character) return
      const history = this.character.levelUpHistory ?? []
      const record = history[history.length - 1]
      if (!record || record.level !== this.character.level) return

      for (const [id, amount] of Object.entries(record.attributeDeltas)) {
        this.character.attributes[id as AttributeId] -= amount ?? 0
      }
      for (const [id, amount] of Object.entries(record.skillDeltas)) {
        this.character.skills[id as SkillId] -= amount ?? 0
      }

      if (record.focusText) {
        const index = this.character.focuses.indexOf(record.focusText)
        if (index !== -1) this.character.focuses.splice(index, 1)
      }
      if (record.replacementFocusText) {
        const index = this.character.focuses.indexOf(record.replacementFocusText)
        if (index !== -1) this.character.focuses.splice(index, 1)
      }
      if (record.removeFocusText) this.character.focuses.push(record.removeFocusText)

      for (const id of [...record.narrativeTalentIds, ...record.combatTalentIds]) {
        const index = this.character.talentIds.indexOf(id)
        if (index !== -1) this.character.talentIds.splice(index, 1)
      }
      if (record.removeTalentIds?.length) this.character.talentIds.push(...record.removeTalentIds)

      this.character.level -= 1
      this.character.currentHp = record.previousCurrentHp
      this.character.currentWillpower = record.previousCurrentWillpower
      this.character.levelUpHistory = history.slice(0, -1)

      await this.persist()
    },
  },
})
