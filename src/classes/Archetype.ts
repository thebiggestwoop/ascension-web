import type { ICharacterData } from './Character'

export interface IArchetypeSummary {
  id: string
  name: string
  description: string
  /** Tips for how to actually play this Archetype - shown on ArchetypePreviewStep in place of
   * the generic "here's what this comes with" text, and defaulted into the finished
   * character's Notes field (see applyArchetypeFinishingTouches). */
  playstyle: string
}

export interface IArchetypeCategoryData {
  id: string
  name: string
  description: string
  archetypes: IArchetypeSummary[]
}

export function findArchetypeSummary(
  categories: IArchetypeCategoryData[],
  archetypeId: string,
): IArchetypeSummary | undefined {
  for (const category of categories) {
    const found = category.archetypes.find((a) => a.id === archetypeId)
    if (found) return found
  }
  return undefined
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
