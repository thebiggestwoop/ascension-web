import localforage from 'localforage'
import type { ICharacterData } from '@/classes/Character'
import type { ICustomNpcData } from '@/classes/CustomNpc'
import type { IEncounterData } from '@/classes/Encounter'
import type { IArmyData } from '@/classes/Army'

const characterStore = localforage.createInstance({ name: 'ascension', storeName: 'characters' })
const npcStore = localforage.createInstance({ name: 'ascension', storeName: 'npcs' })
const npcMetaStore = localforage.createInstance({ name: 'ascension', storeName: 'npcMeta' })
const encounterStore = localforage.createInstance({ name: 'ascension', storeName: 'encounters' })
const armyStore = localforage.createInstance({ name: 'ascension', storeName: 'armies' })

export async function saveCharacter(id: string, data: ICharacterData): Promise<void> {
  await characterStore.setItem(id, data)
}

export async function loadCharacter(id: string): Promise<ICharacterData | null> {
  return characterStore.getItem<ICharacterData>(id)
}

export async function listCharacterIds(): Promise<string[]> {
  return characterStore.keys()
}

export async function deleteCharacter(id: string): Promise<void> {
  await characterStore.removeItem(id)
}

/** GM Toolkit NPC Builder NPCs, keyed by id. */
export async function saveCustomNpc(data: ICustomNpcData): Promise<void> {
  await npcStore.setItem(data.id, data)
}

export async function listCustomNpcs(): Promise<ICustomNpcData[]> {
  const npcs: ICustomNpcData[] = []
  await npcStore.iterate<ICustomNpcData, void>((value) => {
    // NPCs saved before custom tags existed
    value.customTags ??= []
    npcs.push(value)
  })
  return npcs
}

export async function deleteCustomNpc(id: string): Promise<void> {
  await npcStore.removeItem(id)
}

/** Every custom NPC tag the GM has created, kept even when no NPC currently uses it. */
export async function loadNpcTagRegistry(): Promise<string[]> {
  return (await npcMetaStore.getItem<string[]>('tags')) ?? []
}

export async function saveNpcTagRegistry(tags: string[]): Promise<void> {
  await npcMetaStore.setItem('tags', tags)
}

/** GM Toolkit Encounter Builder encounters, keyed by id. */
export async function saveEncounter(data: IEncounterData): Promise<void> {
  await encounterStore.setItem(data.id, data)
}

export async function listEncounters(): Promise<IEncounterData[]> {
  const encounters: IEncounterData[] = []
  await encounterStore.iterate<IEncounterData, void>((value) => {
    encounters.push(value)
  })
  return encounters
}

export async function deleteEncounter(id: string): Promise<void> {
  await encounterStore.removeItem(id)
}

/** Army Sheet armies, keyed by id. */
export async function saveArmy(data: IArmyData): Promise<void> {
  await armyStore.setItem(data.id, data)
}

export async function loadArmy(id: string): Promise<IArmyData | null> {
  return armyStore.getItem<IArmyData>(id)
}

export async function listArmies(): Promise<IArmyData[]> {
  const armies: IArmyData[] = []
  await armyStore.iterate<IArmyData, void>((value) => {
    armies.push(value)
  })
  return armies
}

export async function deleteArmy(id: string): Promise<void> {
  await armyStore.removeItem(id)
}
