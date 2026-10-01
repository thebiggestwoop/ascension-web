import type { ICustomNpcData } from '@/classes/CustomNpc'
import type { IEncounterData } from '@/classes/Encounter'
import { CoreContent } from './ContentLoader'
import { sanitizeFilename } from './CharacterTransfer'

const FORMAT = 'ascension-encounter'
const VERSION = 1

/**
 * A self-contained encounter export: the encounter plus a full copy of every Builder NPC it
 * uses, so it loads on anyone's site even if they've never seen those NPCs. NPCs only reference
 * rulebook classes (baseNpcId), which every copy of the app bundles.
 */
export interface IEncounterExportFile {
  format: typeof FORMAT
  version: number
  exportedAt: string
  encounter: IEncounterData
  npcs: ICustomNpcData[]
}

export function exportEncounterToFile(encounter: IEncounterData, allNpcs: ICustomNpcData[]): void {
  const used = new Set(encounter.entries.map((e) => e.npcId))
  const file: IEncounterExportFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    encounter,
    npcs: allNpcs.filter((n) => used.has(n.id)),
  }
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(encounter.name)}.encounter.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function looksLikeNpc(v: unknown): v is ICustomNpcData {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.baseNpcId === 'string' &&
    [1, 2, 3].includes(v.tier as number) &&
    isObject(v.skills) &&
    Array.isArray(v.optionalFeatureKeys)
  )
}

function looksLikeEncounter(v: unknown): v is IEncounterData {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.entries) &&
    v.entries.every((e) => isObject(e) && typeof e.npcId === 'string')
  )
}

/** Reads and validates an encounter export, throwing a GM-facing message if it's unusable. */
export async function readEncounterFile(file: File): Promise<IEncounterExportFile> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error(`"${file.name}" isn't valid JSON.`)
  }
  if (!isObject(parsed) || parsed.format !== FORMAT || !looksLikeEncounter(parsed.encounter) || !Array.isArray(parsed.npcs)) {
    throw new Error(`"${file.name}" doesn't look like an Ascension encounter export.`)
  }
  if (typeof parsed.version === 'number' && parsed.version > VERSION) {
    throw new Error(`"${file.name}" was made by a newer version of this site. Refresh the page and try again.`)
  }
  const npcs = parsed.npcs.filter(looksLikeNpc)
  if (npcs.length !== parsed.npcs.length) throw new Error(`"${file.name}" has NPC data that couldn't be read.`)

  const unknownClasses = [...new Set(npcs.map((n) => n.baseNpcId))].filter(
    (id) => !CoreContent.npcs.classes.some((c) => c.id === id),
  )
  if (unknownClasses.length) {
    throw new Error(`"${file.name}" uses NPC classes this site doesn't have (${unknownClasses.join(', ')}).`)
  }
  const missing = parsed.encounter.entries.filter((e) => !npcs.some((n) => n.id === e.npcId))
  if (missing.length) throw new Error(`"${file.name}" is missing data for ${missing.length} of its NPCs.`)

  return parsed as unknown as IEncounterExportFile
}

/** Same NPC on both sides: identical build, ignoring timestamps, the name (an earlier import
 * may have renamed it to avoid a clash) and tag capitalisation (imports adopt this site's). */
function sameNpc(a: ICustomNpcData, b: ICustomNpcData): boolean {
  const strip = (n: ICustomNpcData) =>
    JSON.stringify({
      ...n,
      name: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      customTags: (n.customTags ?? []).map((t) => t.toLowerCase()),
    })
  return strip(a) === strip(b)
}

/** "Name", or "Name (2)", "(3)"... if taken (case-insensitive). */
function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) return name
  let i = 2
  while (taken.has(`${name} (${i})`.toLowerCase())) i++
  return `${name} (${i})`
}

export interface IEncounterImportPlan {
  encounter: IEncounterData
  /** NPCs to add to this site's Builder (already given fresh ids/unique names where needed). */
  newNpcs: ICustomNpcData[]
  /** How many of the file's NPCs were already here, unchanged, and are reused. */
  reusedCount: number
}

/**
 * Works out how an export merges into this site without overwriting anything: an NPC that's
 * already here unchanged is reused; every other NPC is added - with a fresh id if its id is
 * taken by a different NPC, and "(2)", "(3)"... appended if its name is taken. The encounter
 * itself always gets a fresh id, like character imports, and "(2)"... if its name is taken.
 */
export function planEncounterImport(
  file: IEncounterExportFile,
  existing: ICustomNpcData[],
  existingEncounterNames: string[],
): IEncounterImportPlan {
  const takenNames = new Set(existing.map((n) => n.name.trim().toLowerCase()))
  const idMap = new Map<string, string>()
  const newNpcs: ICustomNpcData[] = []
  let reusedCount = 0
  const now = new Date().toISOString()

  for (const npc of file.npcs) {
    const local = existing.find((n) => n.id === npc.id)
    if (local && sameNpc(local, npc)) {
      idMap.set(npc.id, local.id)
      reusedCount++
      continue
    }
    const id = local ? crypto.randomUUID() : npc.id
    const name = uniqueName(npc.name.trim(), takenNames)
    takenNames.add(name.toLowerCase())
    idMap.set(npc.id, id)
    newNpcs.push({ ...npc, id, name, customTags: npc.customTags ?? [], notes: npc.notes ?? '', updatedAt: now })
  }

  const encounter: IEncounterData = {
    ...file.encounter,
    id: crypto.randomUUID(),
    name: uniqueName(file.encounter.name.trim(), new Set(existingEncounterNames.map((n) => n.trim().toLowerCase()))),
    entries: file.encounter.entries.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      npcId: idMap.get(e.npcId)!,
      alliance: e.alliance ?? 'enemy',
      deployment: e.deployment ?? 'main',
      deploysOnRound: e.deploysOnRound ?? null,
    })),
    createdAt: now,
    updatedAt: now,
  }
  return { encounter, newNpcs, reusedCount }
}
