/**
 * Armies (Chapters Nine-Eleven): content shapes for content/armies/*.json, the saved army a
 * party builds, and the mass-combat bookkeeping its sheet tracks (division Morale, Broken,
 * stratagem uses). Framework-agnostic - no Vue here.
 */

export type DivisionType = 'Infantry' | 'Cavalry' | 'Projectile' | 'Flying' | 'Magick' | 'Support' | 'Siege'

export interface IDivisionData {
  id: string
  name: string
  description: string
  types: DivisionType[]
  resistance: number
  attack: { damageCD: number; ranged: boolean; effects?: string[] }
  /** The buff it grants allied officers in its zone; null for siege engines. */
  buff: { name: string; text: string } | null
  features: string[]
}

export interface IStratagemData {
  id: string
  name: string
  kind: 'order' | 'passive'
  /** "Applicable Divisions" exactly as printed. */
  applicableText: string
  applicableTypes: DivisionType[]
  applicableDivisionIds: string[]
  /** "N/scene" limit; absent = no limit. */
  usesPerScene?: number
  text: string
}

export interface IArmyTalentData {
  id: string
  name: string
  text: string
}

export interface IArmyRulesData {
  scale: { scale: number; armySize: string }[]
  baseMorale: number
  talentsByLevel: { minLevel: number; maxLevel: number; talents: number }[]
  divisionTypes: { name: DivisionType; description: string }[]
  buffStacking: string
}

/** One recruited division and its battle state. */
export interface IArmyDivision {
  /** Unique within the army (two Mages divisions are two entries). */
  id: string
  divisionId: string
  /** Optional name to tell duplicates apart, e.g. "1st Footmen". */
  nickname: string
  /** "Each division gets 1 stratagem." */
  stratagemId: string | null
  /** Brought to the current battle - fewer than Scale grants the Scale bonus. */
  deployed: boolean
  morale: number
  broken: boolean
  stratagemUsesSpent: number
  freeMoveUsed: boolean
  /** Mounted Infantry stratagem: starts mounted, can dismount once per scene. */
  mounted: boolean
}

export interface IArmyData {
  id: string
  name: string
  scale: number
  /** Party level, which sets how many Army Talents the army has. */
  partyLevel: number
  talentIds: string[]
  definingFeature: string
  divisions: IArmyDivision[]
  notes: string
  createdAt: string
  updatedAt: string
}

export const MAX_SCALE = 10

/** "Level 0-3: 1 Talent, 4-7: 2, 8-11: 3, 12: 4." */
export function talentCount(rules: IArmyRulesData, partyLevel: number): number {
  return rules.talentsByLevel.find((t) => partyLevel >= t.minLevel && partyLevel <= t.maxLevel)?.talents ?? 1
}

export function stratagemsFor(division: IDivisionData, stratagems: IStratagemData[]): IStratagemData[] {
  return stratagems.filter(
    (s) => s.applicableDivisionIds.includes(division.id) || s.applicableTypes.some((t) => division.types.includes(t)),
  )
}

/** One Trait per unique division (two Mages divisions = one Mages Trait), plus the Defining Feature. */
export function armyTraits(army: IArmyData, divisions: IDivisionData[]): string[] {
  const names = [...new Set(army.divisions.map((d) => divisions.find((x) => x.id === d.divisionId)?.name))].filter(
    (n): n is string => !!n,
  )
  return army.definingFeature.trim() ? [...names, army.definingFeature.trim()] : names
}

/** "If an army brings fewer divisions to battle than its scale allows, all divisions start the
 * battle with 1 extra point of morale and roll 1 extra [CD] on attacks against other
 * divisions for every point of scale above the number brought." */
export function scaleBonus(army: IArmyData): number {
  const brought = army.divisions.filter((d) => d.deployed).length
  return Math.max(0, army.scale - brought)
}

/** "A division's morale starts with a morale of 8, plus any bonus from the army's scale." */
export function startingMorale(army: IArmyData, rules: IArmyRulesData): number {
  return rules.baseMorale + scaleBonus(army)
}

export function newArmyDivision(division: IDivisionData, stratagemId: string | null, morale: number): IArmyDivision {
  return {
    id: crypto.randomUUID(),
    divisionId: division.id,
    nickname: '',
    stratagemId,
    deployed: true,
    morale,
    broken: false,
    stratagemUsesSpent: 0,
    freeMoveUsed: false,
    mounted: stratagemId === 'mounted_infantry',
  }
}

/** "Its morale is reduced equal to the damage taken, subtracting the division's Resistance if
 * relevant." Morale 0 = Broken (it stays Broken until Regrouped). Returns the Morale lost. */
export function damageDivision(div: IArmyDivision, amount: number, resistance: number, ignoreResistance: boolean): number {
  const lost = Math.min(div.morale, Math.max(0, amount - (ignoreResistance ? 0 : resistance)))
  div.morale -= lost
  if (div.morale <= 0) div.broken = true
  return lost
}

/** Morale restored by effects like Inspiring Tune or the Military Band - only for unbroken
 * divisions (a Broken one needs Regroup), capped at its starting Morale. */
export function restoreMorale(div: IArmyDivision, amount: number, max: number): void {
  if (div.broken) return
  div.morale = Math.min(max, div.morale + Math.max(0, amount))
}

/** Regroup: "the division regains 2 + the officer's Authority [CD]. If the division was
 * broken, it no longer is." */
export function regroupDivision(div: IArmyDivision, amount: number, max: number): void {
  div.broken = false
  div.morale = Math.min(max, div.morale + Math.max(0, amount))
}

/** Start of a battle (scene): full Morale, nothing Broken, stratagem uses and Free Moves reset. */
export function resetForBattle(army: IArmyData, rules: IArmyRulesData): void {
  const morale = startingMorale(army, rules)
  for (const d of army.divisions) {
    d.morale = morale
    d.broken = false
    d.stratagemUsesSpent = 0
    d.freeMoveUsed = false
    d.mounted = d.stratagemId === 'mounted_infantry'
  }
}

export function createArmy(): IArmyData {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: '',
    scale: 3,
    partyLevel: 0,
    talentIds: [],
    definingFeature: '',
    divisions: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}
