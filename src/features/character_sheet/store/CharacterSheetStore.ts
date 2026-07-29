import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import type { ICharacterData } from '@/classes/Character'
import { loadCharacter, saveCharacter } from '@/io/Storage'

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
  },
})
