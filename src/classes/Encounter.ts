export type EncounterAlliance = 'enemy' | 'ally' | 'neutral'
export type EncounterDeployment = 'main' | 'reinforcement'

export const ALLIANCE_LABEL: Record<EncounterAlliance, string> = {
  enemy: 'Enemy',
  ally: 'Ally',
  neutral: 'Neutral',
}

export const DEPLOYMENT_LABEL: Record<EncounterDeployment, string> = {
  main: 'Main Forces',
  reinforcement: 'Reinforcement',
}

/** One NPC placed in an encounter. The same Builder NPC can be added several times (e.g.
 * three Gate Guards), each as its own entry with its own Alliance/Deployment. */
export interface IEncounterEntry {
  /** Unique within the encounter - not the NPC's id. */
  id: string
  /** Id of a Builder NPC (ICustomNpcData). */
  npcId: string
  alliance: EncounterAlliance
  deployment: EncounterDeployment
  /** Reinforcements only, optional: the round they arrive on. */
  deploysOnRound: number | null
}

export interface IEncounterData {
  id: string
  name: string
  entries: IEncounterEntry[]
  createdAt: string
  updatedAt: string
}

export function createEncounter(name: string): IEncounterData {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), name: name.trim(), entries: [], createdAt: now, updatedAt: now }
}

export function createEncounterEntry(npcId: string): IEncounterEntry {
  return { id: crypto.randomUUID(), npcId, alliance: 'enemy', deployment: 'main', deploysOnRound: null }
}
