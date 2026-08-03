import type { ICharacterData } from '@/classes/Character'
import { migrateLegacyCharacterData } from '@/classes/Character'
import { saveCharacter } from './Storage'

/** Turns "Sir Reginald the Bold" into "Sir-Reginald-the-Bold" - safe on every OS's filesystem. */
function sanitizeFilename(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-')
  return cleaned || 'character'
}

/** Downloads a character as a standalone .json file the player can back up or hand to someone else. */
export function exportCharacterToFile(character: ICharacterData): void {
  const json = JSON.stringify(character, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(character.name)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Just enough shape-checking to reject "wrong file entirely" without being brittle to every
 * field ever added to ICharacterData since - fields added later are backfilled by
 * migrateLegacyCharacterData() instead of required here. */
function looksLikeCharacterData(value: unknown): value is ICharacterData {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.attributes === 'object' &&
    v.attributes !== null &&
    typeof v.skills === 'object' &&
    v.skills !== null &&
    Array.isArray(v.talentIds)
  )
}

/**
 * Parses a File selected via an <input type="file">, validates it's plausibly a character
 * export, assigns it a fresh id (so importing never silently overwrites an existing character -
 * on this device or anyone else's - that happens to share the exported id), and persists it.
 * Throws with a player-facing message on anything that doesn't parse or doesn't look right.
 */
export async function importCharacterFromFile(file: File): Promise<ICharacterData> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`"${file.name}" isn't valid JSON.`)
  }
  if (!looksLikeCharacterData(parsed)) {
    throw new Error(`"${file.name}" doesn't look like an Ascension character export.`)
  }
  const character = migrateLegacyCharacterData({ ...parsed, id: crypto.randomUUID() })
  await saveCharacter(character.id, character)
  return character
}
