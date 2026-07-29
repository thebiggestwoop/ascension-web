import localforage from 'localforage'
import type { ICharacterData } from '@/classes/Character'

const characterStore = localforage.createInstance({ name: 'ascension', storeName: 'characters' })

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
