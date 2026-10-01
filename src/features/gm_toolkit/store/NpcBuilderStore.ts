import { defineStore } from 'pinia'
import type { AttributeId, SkillId } from '@/classes/enums'
import type { ICustomNpcData, NpcBodyPart } from '@/classes/CustomNpc'
import { changeTier, createCustomNpc, seedStats } from '@/classes/CustomNpc'
import type { NpcTier } from '@/classes/Npc'
import { CoreContent } from '@/io/ContentLoader'
import { deleteCustomNpc, listCustomNpcs, loadNpcTagRegistry, saveCustomNpc, saveNpcTagRegistry } from '@/io/Storage'

/** Plain (non-Proxy) copy for localforage, which structured-clones what it stores. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function baseOf(npc: ICustomNpcData) {
  const base = CoreContent.npcs.classes.find((n) => n.id === npc.baseNpcId)
  if (!base) throw new Error(`Unknown NPC class "${npc.baseNpcId}"`)
  return base
}

export const useNpcBuilderStore = defineStore('npcBuilder', {
  state: () => ({
    npcs: [] as ICustomNpcData[],
    /** All custom tags ever created, alphabetical. */
    tagRegistry: [] as string[],
    loaded: false,
    selectedId: null as string | null,
  }),
  getters: {
    selected: (state) => state.npcs.find((n) => n.id === state.selectedId) ?? null,
  },
  actions: {
    async load() {
      if (this.loaded) return
      this.npcs = (await listCustomNpcs()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      // Registry plus any tag already on an NPC, in case the two ever drift apart.
      const tags = new Map<string, string>()
      for (const t of [...(await loadNpcTagRegistry()), ...this.npcs.flatMap((n) => n.customTags)]) {
        if (!tags.has(t.toLowerCase())) tags.set(t.toLowerCase(), t)
      }
      this.tagRegistry = [...tags.values()].sort((a, b) => a.localeCompare(b))
      this.loaded = true
    },
    /** Names must be unique (case-insensitive, ignoring surrounding spaces). */
    isNameTaken(name: string, exceptId?: string): boolean {
      const key = name.trim().toLowerCase()
      return this.npcs.some((n) => n.id !== exceptId && n.name.trim().toLowerCase() === key)
    },
    async create(baseNpcId: string, name: string, tier: NpcTier) {
      const base = CoreContent.npcs.classes.find((n) => n.id === baseNpcId)
      if (!base) return
      const npc = createCustomNpc(base, name.trim(), tier)
      this.npcs.push(npc)
      this.selectedId = npc.id
      await saveCustomNpc(plain(npc))
    },
    async update(id: string, change: (npc: ICustomNpcData) => ICustomNpcData | void) {
      const i = this.npcs.findIndex((n) => n.id === id)
      if (i < 0) return
      const draft = plain(this.npcs[i])
      const next = change(draft) ?? draft
      next.updatedAt = new Date().toISOString()
      this.npcs[i] = next
      await saveCustomNpc(plain(next))
    },
    rename(id: string, name: string) {
      return this.update(id, (n) => {
        n.name = name.trim()
      })
    },
    setTier(id: string, tier: NpcTier) {
      return this.update(id, (n) => changeTier(n, baseOf(n), tier))
    },
    toggleOptionalFeature(id: string, key: string) {
      return this.update(id, (n) => {
        n.optionalFeatureKeys = n.optionalFeatureKeys.includes(key)
          ? n.optionalFeatureKeys.filter((k) => k !== key)
          : [...n.optionalFeatureKeys, key]
      })
    },
    setTemplate(id: string, templateId: string | null) {
      return this.update(id, (n) => {
        n.templateId = templateId
        n.templateFeatureNames = []
      })
    },
    toggleTemplateFeature(id: string, name: string) {
      return this.update(id, (n) => {
        n.templateFeatureNames = n.templateFeatureNames.includes(name)
          ? n.templateFeatureNames.filter((f) => f !== name)
          : [...n.templateFeatureNames, name]
      })
    },
    setAttribute(id: string, attribute: AttributeId, value: number, part?: NpcBodyPart) {
      return this.update(id, (n) => {
        if (part && n.parts) n.parts[part][attribute] = value
        else if (n.attributes) n.attributes[attribute] = value
      })
    },
    setSkill(id: string, skill: SkillId, value: number) {
      return this.update(id, (n) => {
        n.skills[skill] = value
      })
    },
    setResistance(id: string, value: number) {
      return this.update(id, (n) => {
        n.resistance = value
      })
    },
    /** Puts Attributes, Skills and Resistance back to the class's values at the current tier. */
    resetStats(id: string) {
      return this.update(id, (n) => ({ ...n, ...seedStats(baseOf(n), n.tier) }))
    },
    setNotes(id: string, notes: string) {
      return this.update(id, (n) => {
        n.notes = notes
      })
    },
    /** Applies a tag, reusing an existing tag's spelling when it differs only in case, and
     * adding brand-new tags to the registry. */
    async addTag(id: string, raw: string) {
      const typed = raw.trim().replace(/\s+/g, ' ')
      if (!typed) return
      let tag = this.tagRegistry.find((t) => t.toLowerCase() === typed.toLowerCase())
      if (!tag) {
        tag = typed
        this.tagRegistry = [...this.tagRegistry, tag].sort((a, b) => a.localeCompare(b))
        await saveNpcTagRegistry(plain(this.tagRegistry))
      }
      const applied = tag
      await this.update(id, (n) => {
        if (!n.customTags.includes(applied)) n.customTags.push(applied)
      })
    },
    removeTag(id: string, tag: string) {
      return this.update(id, (n) => {
        n.customTags = n.customTags.filter((t) => t !== tag)
      })
    },
    /** Adds NPCs brought in by an encounter import, registering any new custom tags. */
    async addImported(npcs: ICustomNpcData[]) {
      // Reuse this site's spelling of a tag that differs only in case.
      const spelling = new Map(this.tagRegistry.map((t) => [t.toLowerCase(), t]))
      for (const npc of npcs) {
        npc.customTags = [...new Set(npc.customTags.map((t) => spelling.get(t.toLowerCase()) ?? t))]
        this.npcs.push(npc)
        await saveCustomNpc(plain(npc))
      }
      const known = new Set(this.tagRegistry.map((t) => t.toLowerCase()))
      const fresh = [...new Set(npcs.flatMap((n) => n.customTags))].filter((t) => !known.has(t.toLowerCase()))
      if (fresh.length) {
        this.tagRegistry = [...this.tagRegistry, ...fresh].sort((a, b) => a.localeCompare(b))
        await saveNpcTagRegistry(plain(this.tagRegistry))
      }
    },
    async remove(id: string) {
      this.npcs = this.npcs.filter((n) => n.id !== id)
      if (this.selectedId === id) this.selectedId = null
      await deleteCustomNpc(id)
    },
  },
})
