import type { IArmyData } from '@/classes/Army'
import { CoreContent } from './ContentLoader'
import { sanitizeFilename } from './CharacterTransfer'
import { saveArmy } from './Storage'

const FORMAT = 'ascension-army'
const VERSION = 1

/** An army export: the whole army, battle state included. Divisions, stratagems and talents
 * are referenced by id - every copy of the app bundles the same rulebook content. */
export interface IArmyExportFile {
  format: typeof FORMAT
  version: number
  exportedAt: string
  army: IArmyData
}

function download(text: string, filename: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportArmyToFile(army: IArmyData): void {
  const file: IArmyExportFile = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), army }
  download(JSON.stringify(file, null, 2), `${sanitizeFilename(army.name)}.army.json`, 'application/json')
}

export function downloadText(text: string, filename: string): void {
  download(text, filename, 'text/plain')
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function looksLikeArmy(v: unknown): v is IArmyData {
  return (
    isObject(v) &&
    typeof v.name === 'string' &&
    typeof v.scale === 'number' &&
    Array.isArray(v.divisions) &&
    v.divisions.every((d) => isObject(d) && typeof d.divisionId === 'string') &&
    Array.isArray(v.talentIds)
  )
}

/**
 * Parses an army export, checks everything it references exists on this site, and saves it
 * under a fresh id (so importing never overwrites an army, here or on anyone else's device).
 * Throws with a player-facing message if the file can't be used.
 */
export async function importArmyFromFile(file: File): Promise<IArmyData> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error(`"${file.name}" isn't valid JSON.`)
  }
  if (!isObject(parsed) || parsed.format !== FORMAT || !looksLikeArmy(parsed.army)) {
    throw new Error(`"${file.name}" doesn't look like an Ascension army export.`)
  }
  if (typeof parsed.version === 'number' && parsed.version > VERSION) {
    throw new Error(`"${file.name}" was made by a newer version of this site. Refresh the page and try again.`)
  }
  const source = parsed.army
  const { divisions, stratagems, talents } = CoreContent.armies
  const unknown = [
    ...source.divisions.filter((d) => !divisions.some((x) => x.id === d.divisionId)).map((d) => d.divisionId),
    ...source.divisions
      .filter((d) => d.stratagemId && !stratagems.some((x) => x.id === d.stratagemId))
      .map((d) => d.stratagemId as string),
    ...source.talentIds.filter((t) => !talents.some((x) => x.id === t)),
  ]
  if (unknown.length) {
    throw new Error(`"${file.name}" uses rules this site doesn't have (${[...new Set(unknown)].join(', ')}).`)
  }

  const now = new Date().toISOString()
  const army: IArmyData = {
    id: crypto.randomUUID(),
    name: source.name,
    scale: source.scale,
    partyLevel: source.partyLevel ?? 0,
    talentIds: source.talentIds,
    definingFeature: source.definingFeature ?? '',
    notes: source.notes ?? '',
    createdAt: now,
    updatedAt: now,
    divisions: source.divisions.map((d) => ({
      id: crypto.randomUUID(),
      divisionId: d.divisionId,
      nickname: d.nickname ?? '',
      stratagemId: d.stratagemId ?? null,
      deployed: d.deployed ?? true,
      morale: d.morale ?? CoreContent.armies.rules.baseMorale,
      broken: !!d.broken,
      stratagemUsesSpent: d.stratagemUsesSpent ?? 0,
      freeMoveUsed: !!d.freeMoveUsed,
      mounted: !!d.mounted,
    })),
  }
  await saveArmy(army)
  return army
}
