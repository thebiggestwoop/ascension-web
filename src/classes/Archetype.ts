import type { ICharacterData } from './Character'

export interface IArchetypeSummary {
  id: string
  name: string
  description: string
}

export interface IArchetypeCategoryData {
  id: string
  name: string
  description: string
  archetypes: IArchetypeSummary[]
}

/**
 * A pregen character (content/archetypes/<category>/<id>.json) used as a starting point for
 * the "Start from an Archetype" creation method. Same shape as an exported character - see
 * CharacterTransfer.ts - with the player-specific free text (Focuses, Values, Defining Feature)
 * left as the literal string "placeholder", since those are personal narrative details no
 * generic archetype can sensibly predetermine; QuickBuildStep's prefill leaves those fields
 * blank for the player to fill in themselves rather than prefilling the placeholder text.
 */
export type IArchetypeCharacterData = ICharacterData
