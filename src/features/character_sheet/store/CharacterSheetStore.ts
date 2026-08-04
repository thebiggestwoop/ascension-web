import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import type { AttributeId, SkillId } from '@/classes/enums'
import type { ICharacterData, ITrait } from '@/classes/Character'
import { Character, computeStatModifiers, migrateLegacyCharacterData } from '@/classes/Character'
import type { ILevelUpChoices, ILevelUpRecord } from '@/classes/CharacterHistory'
import { SPELLCASTER_TALENT_IDS } from '@/classes/Spell'
import { CoreContent } from '@/io/ContentLoader'
import { loadCharacter, saveCharacter } from '@/io/Storage'

export type ILevelUpPayload = ILevelUpChoices

/**
 * Reassigning a ref's `.value` to a freshly-emitted plain object (the `(p) => (x = p)` pattern
 * LevelUpDialog/TalentPicker use) makes Vue wrap it - and its nested arrays - in reactive
 * Proxies on the next read, even though the emitted payload started out plain. Harmless until
 * the whole payload is stored verbatim (levelUpHistory) inside character data that later gets
 * structuredClone()'d (Character.Deserialize does this on every save): a live Proxy anywhere in
 * that graph makes the clone throw ("could not be cloned"). Round-tripping through JSON
 * guarantees a fully plain copy since JSON.stringify only ever reads a Proxy's own enumerable
 * data.
 */
function toPlainRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
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
      if (data) migrateLegacyCharacterData(data)
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
    /** Temporary Resistance from a buff/spell/etc. - player-entered, floored at 0 and capped at 5. */
    async setTemporaryResistance(value: number) {
      if (!this.character) return
      this.character.temporaryResistance = Math.max(0, Math.min(5, Math.round(value)))
      await this.persist()
    },
    /** Temporary HP from a buff/spell/etc. - player-entered, floored at 0 and capped at 50. */
    async setTemporaryHp(value: number) {
      if (!this.character) return
      this.character.temporaryHp = Math.max(0, Math.min(50, Math.round(value)))
      await this.persist()
    },
    async toggleValueActive(index: number) {
      if (!this.character) return
      const value = this.character.values[index]
      if (!value) return
      value.active = !value.active
      await this.persist()
    },
    /** "Challenge: ...crossing it out on your character sheet... cannot use your crossed out
     * Value again" (Chapter Three) - a separate, longer-lived state from simply being called
     * upon (`active`). */
    async toggleValueChallenged(index: number) {
      if (!this.character) return
      const value = this.character.values[index]
      if (!value) return
      value.challenged = !value.challenged
      await this.persist()
    },
    /** "Characters may not have more than 3 points of Determination at a time" (Chapter Three) -
     * the Spend/Gain buttons on the Values card. */
    async adjustDetermination(delta: number) {
      if (!this.character) return
      this.character.determination = Math.max(0, Math.min(3, this.character.determination + delta))
      await this.persist()
    },
    async updateValueText(index: number, text: string) {
      if (!this.character) return
      const value = this.character.values[index]
      if (!value) return
      value.text = text
      await this.persist()
    },
    async updateFocusText(index: number, text: string) {
      if (!this.character) return
      if (this.character.focuses[index] === undefined) return
      this.character.focuses[index] = text
      await this.persist()
    },
    /** "Edit Lifepath" (see EditLifepathDialog): replaces the whole Traits list and careerId
     * verbatim with what the dialog computed - Attributes/Skills/Focuses/Values/Talents/
     * Equipment are never part of this payload, so they're untouched by definition. */
    async updateLifepathTraits(payload: { traits: ITrait[]; careerId?: string }) {
      if (!this.character) return
      // toPlainRecord(): the payload's Trait objects came from spreading `character.traits`
      // (a reactive Proxy array) inside EditLifepathDialog - see toPlainRecord's own doc
      // comment above for why that still leaves individual entries Proxy-wrapped, which
      // structuredClone() (used by persist()) can't handle.
      this.character.traits = toPlainRecord(payload.traits)
      this.character.careerId = payload.careerId
      await this.persist()
    },
    /** The Common Cause is a fifth, party-wide Value (see IValue.commonCause's doc comment) -
     * always exactly one, so unlike `values` above it has no add/remove, just the same
     * text/Called-Upon/Challenged mutations. */
    async updateCommonCauseText(text: string) {
      if (!this.character) return
      this.character.commonCause.text = text
      await this.persist()
    },
    async toggleCommonCauseActive() {
      if (!this.character) return
      this.character.commonCause.active = !this.character.commonCause.active
      await this.persist()
    },
    async toggleCommonCauseChallenged() {
      if (!this.character) return
      this.character.commonCause.challenged = !this.character.commonCause.challenged
      await this.persist()
    },
    async adjustXp(delta: number) {
      if (!this.character) return
      this.character.xp = Math.max(0, this.character.xp + delta)
      await this.persist()
    },
    /** The Inventory list's "Use"/"Reset" buttons (see IGeneralItemData.healsHealthBars) -
     * marks/unmarks a general item id as used, keyed by id (not per stacked copy), so using one
     * copy greys out every copy of that item until Reset. */
    async setGeneralItemUsed(itemId: string, used: boolean) {
      if (!this.character) return
      const set = new Set(this.character.usedGeneralItemIds)
      if (used) set.add(itemId)
      else set.delete(itemId)
      this.character.usedGeneralItemIds = [...set]
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
    async updateNotes(notes: string) {
      if (!this.character) return
      this.character.notes = notes
      await this.persist()
    },
    /** Applies one Level Ascension Chart entry's grants and refills HP/Willpower to the new max. */
    async levelUp(payload: ILevelUpPayload) {
      if (!this.character) return
      const previousCurrentHp = this.character.currentHp
      const previousCurrentWillpower = this.character.currentWillpower
      const previousCombatSkillFocuses = [...this.character.combatSkillFocuses]

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

      const grantedTraitNames: string[] = []
      const newTalentIds = [...payload.narrativeTalentIds, ...payload.combatTalentIds]
      const alreadySpellcaster = this.character.traits.some((t) => t.name === 'Spellcaster')
      if (!alreadySpellcaster && newTalentIds.some((id) => SPELLCASTER_TALENT_IDS.includes(id))) {
        grantedTraitNames.push('Spellcaster')
      }
      for (const name of grantedTraitNames) {
        this.character.traits.push({ name })
      }

      if (payload.reassignedCombatSkillFocuses) {
        this.character.combatSkillFocuses = [...payload.reassignedCombatSkillFocuses]
      }
      if (payload.thirdCombatFocusSkillId) {
        this.character.combatSkillFocuses = [...this.character.combatSkillFocuses, payload.thirdCombatFocusSkillId]
      }

      const record: ILevelUpRecord = toPlainRecord({
        ...payload,
        level: this.character.level,
        previousCurrentHp,
        previousCurrentWillpower,
        grantedTraitNames,
        previousCombatSkillFocuses,
      })
      // toPlainRecord() the WHOLE array, not just `record`: once a prior level-up's history
      // array was reassigned onto this reactive `character`, Vue re-wraps its entries in its
      // own reactive Proxies on next read - spreading the array only copies those Proxy
      // references, not their contents, so old entries stay Proxied even though `record` here
      // is fresh and plain. That's harmless until persist()'s structuredClone() hits the first
      // Proxy anywhere in the tree and throws - so every level-up after the first would fail
      // to save without this.
      this.character.levelUpHistory = toPlainRecord([...(this.character.levelUpHistory ?? []), record])

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

      for (const name of record.grantedTraitNames ?? []) {
        const index = this.character.traits.findIndex((t) => t.name === name)
        if (index !== -1) this.character.traits.splice(index, 1)
      }

      this.character.level -= 1
      this.character.currentHp = record.previousCurrentHp
      this.character.currentWillpower = record.previousCurrentWillpower
      if (record.previousCombatSkillFocuses) this.character.combatSkillFocuses = record.previousCombatSkillFocuses
      // Same Proxy-re-wrapping risk as levelUp()'s own history assignment - see its comment.
      this.character.levelUpHistory = toPlainRecord(history.slice(0, -1))

      await this.persist()
    },
  },
})
