import type { IDivisionData } from '@/classes/Army'

/** "2[CD]", "2[CD] Piercing" - plus the Scale bonus's extra [CD] when given. */
export function attackLabel(division: IDivisionData, bonusCD = 0): string {
  const effects = division.attack.effects?.length ? ` ${division.attack.effects.join(', ')}` : ''
  return `${division.attack.damageCD + bonusCD}[CD]${effects}`
}
