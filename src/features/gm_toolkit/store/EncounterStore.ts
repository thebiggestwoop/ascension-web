import { defineStore } from 'pinia'
import type { EncounterAlliance, EncounterDeployment, IEncounterData } from '@/classes/Encounter'
import { createEncounter, createEncounterEntry } from '@/classes/Encounter'
import { deleteEncounter, listEncounters, saveEncounter } from '@/io/Storage'
import { exportEncounterToFile, planEncounterImport, readEncounterFile } from '@/io/EncounterTransfer'
import { useNpcBuilderStore } from './NpcBuilderStore'

/** Plain (non-Proxy) copy for localforage, which structured-clones what it stores. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const useEncounterStore = defineStore('encounters', {
  state: () => ({
    encounters: [] as IEncounterData[],
    loaded: false,
    selectedId: null as string | null,
  }),
  getters: {
    selected: (state) => state.encounters.find((e) => e.id === state.selectedId) ?? null,
  },
  actions: {
    async load() {
      if (this.loaded) return
      this.encounters = (await listEncounters()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      this.loaded = true
    },
    async create(name: string) {
      const encounter = createEncounter(name)
      this.encounters.push(encounter)
      this.selectedId = encounter.id
      await saveEncounter(plain(encounter))
    },
    async update(id: string, change: (e: IEncounterData) => void) {
      const i = this.encounters.findIndex((e) => e.id === id)
      if (i < 0) return
      const draft = plain(this.encounters[i])
      change(draft)
      draft.updatedAt = new Date().toISOString()
      this.encounters[i] = draft
      await saveEncounter(plain(draft))
    },
    rename(id: string, name: string) {
      return this.update(id, (e) => {
        e.name = name.trim()
      })
    },
    addNpc(id: string, npcId: string, count = 1) {
      return this.update(id, (e) => {
        for (let i = 0; i < count; i++) e.entries.push(createEncounterEntry(npcId))
      })
    },
    removeEntry(id: string, entryId: string) {
      return this.update(id, (e) => {
        e.entries = e.entries.filter((x) => x.id !== entryId)
      })
    },
    setAlliance(id: string, entryId: string, alliance: EncounterAlliance) {
      return this.update(id, (e) => {
        const entry = e.entries.find((x) => x.id === entryId)
        if (entry) entry.alliance = alliance
      })
    },
    /** Switching back to Main Forces clears the reinforcement round. */
    setDeployment(id: string, entryId: string, deployment: EncounterDeployment) {
      return this.update(id, (e) => {
        const entry = e.entries.find((x) => x.id === entryId)
        if (!entry) return
        entry.deployment = deployment
        if (deployment === 'main') entry.deploysOnRound = null
      })
    },
    setDeploysOnRound(id: string, entryId: string, round: number | null) {
      return this.update(id, (e) => {
        const entry = e.entries.find((x) => x.id === entryId)
        if (entry) entry.deploysOnRound = round
      })
    },
    async remove(id: string) {
      this.encounters = this.encounters.filter((e) => e.id !== id)
      if (this.selectedId === id) this.selectedId = null
      await deleteEncounter(id)
    },
    exportToFile(id: string) {
      const encounter = this.encounters.find((e) => e.id === id)
      if (encounter) exportEncounterToFile(encounter, useNpcBuilderStore().npcs)
    },
    /** Imports an encounter file, adding any NPCs this site doesn't already have. Returns a
     * short summary for the GM. */
    async importFromFile(file: File): Promise<string> {
      const npcStore = useNpcBuilderStore()
      await npcStore.load()
      const plan = planEncounterImport(
        await readEncounterFile(file),
        npcStore.npcs,
        this.encounters.map((e) => e.name),
      )
      await npcStore.addImported(plan.newNpcs)
      this.encounters.push(plan.encounter)
      this.selectedId = plan.encounter.id
      await saveEncounter(plain(plan.encounter))
      const parts = [`Imported "${plan.encounter.name}"`]
      if (plan.newNpcs.length) parts.push(`added ${plan.newNpcs.length} NPC${plan.newNpcs.length === 1 ? '' : 's'} to your NPC Builder`)
      if (plan.reusedCount) parts.push(`reused ${plan.reusedCount} you already had`)
      return parts.join(', ') + '.'
    },
  },
})
