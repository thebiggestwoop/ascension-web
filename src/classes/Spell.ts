export type MagickDomain = 'arcane' | 'light' | 'dark'
export type ActionType = 'major' | 'minor' | 'reaction' | 'passive'

export interface ISpellData {
  id: string
  name: string
  domain: MagickDomain
  tier: 1 | 2 | 3
  tags: string[]
  slotCost: number
  action: ActionType
  usesPerScene: number
  range?: string
  willpowerCost?: number
  effectText: string
}
