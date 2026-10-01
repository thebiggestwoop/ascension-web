import { defineStore } from 'pinia'
import type { IArmyData, IArmyDivision } from '@/classes/Army'
import { damageDivision, regroupDivision, resetForBattle, restoreMorale, startingMorale } from '@/classes/Army'
import { CoreContent } from '@/io/ContentLoader'
import { deleteArmy, listArmies, loadArmy, saveArmy } from '@/io/Storage'

/** Plain (non-Proxy) copy for localforage, which structured-clones what it stores. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const rules = CoreContent.armies.rules

function resistanceOf(div: IArmyDivision): number {
  return CoreContent.armies.divisions.find((d) => d.id === div.divisionId)?.resistance ?? 0
}

export const useArmyStore = defineStore('armies', {
  state: () => ({
    armies: [] as IArmyData[],
    loaded: false,
    /** The army open on the sheet. */
    army: null as IArmyData | null,
    notFound: false,
  }),
  actions: {
    async loadAll() {
      this.armies = (await listArmies()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      this.loaded = true
    },
    async open(id: string) {
      const data = await loadArmy(id)
      this.army = data
      this.notFound = data === null
    },
    async save(army: IArmyData) {
      army.updatedAt = new Date().toISOString()
      await saveArmy(plain(army))
      const i = this.armies.findIndex((a) => a.id === army.id)
      if (i >= 0) this.armies[i] = plain(army)
      else this.armies.push(plain(army))
      if (this.army?.id === army.id) this.army = plain(army)
    },
    async remove(id: string) {
      await deleteArmy(id)
      this.armies = this.armies.filter((a) => a.id !== id)
      if (this.army?.id === id) this.army = null
    },
    /** Applies a change to the open army and saves it. */
    async change(fn: (army: IArmyData) => void) {
      if (!this.army) return
      const draft = plain(this.army)
      fn(draft)
      await this.save(draft)
    },
    division(army: IArmyData, divId: string) {
      return army.divisions.find((d) => d.id === divId)
    },
    damage(divId: string, amount: number, ignoreResistance: boolean) {
      return this.change((a) => {
        const d = this.division(a, divId)
        if (d) damageDivision(d, amount, resistanceOf(d), ignoreResistance)
      })
    },
    restore(divId: string, amount: number) {
      return this.change((a) => {
        const d = this.division(a, divId)
        if (d) restoreMorale(d, amount, startingMorale(a, rules))
      })
    },
    regroup(divId: string, amount: number) {
      return this.change((a) => {
        const d = this.division(a, divId)
        if (d) regroupDivision(d, amount, startingMorale(a, rules))
      })
    },
    /** Direct edit of a division's Morale (0 marks it Broken). */
    setMorale(divId: string, morale: number) {
      return this.change((a) => {
        const d = this.division(a, divId)
        if (!d) return
        d.morale = Math.max(0, Math.min(99, Math.round(morale)))
        if (d.morale === 0) d.broken = true
      })
    },
    patchDivision(divId: string, patch: Partial<IArmyDivision>) {
      return this.change((a) => {
        const d = this.division(a, divId)
        if (d) Object.assign(d, patch)
      })
    },
    newBattle() {
      return this.change((a) => resetForBattle(a, rules))
    },
    /** End of round: every division's Free Move is available again. */
    endRound() {
      return this.change((a) => {
        for (const d of a.divisions) d.freeMoveUsed = false
      })
    },
    setNotes(notes: string) {
      return this.change((a) => {
        a.notes = notes
      })
    },
  },
})
