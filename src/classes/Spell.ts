export type MagickDomain = 'arcane' | 'light' | 'dark'
export type ActionType = 'major' | 'minor' | 'reaction' | 'passive'

/**
 * A spell's mechanical header (tier/tags/cost/action/uses) is enough to list and gate it
 * in the builder/compendium before its full rules text is transcribed. `effectText` and
 * `range` are only present once `transcribed` is true; until then this is index-only data,
 * mirroring ITalentGroupIndexEntry's "mapped but not transcribed" pattern.
 */
export interface ISpellData {
  id: string
  name: string
  domain: MagickDomain
  tier: 1 | 2 | 3
  tags: string[]
  slotCost: number
  action: ActionType
  usesPerScene: number | 'passive'
  willpowerCost?: number
  range?: string
  effectText?: string
  transcribed: boolean
}
