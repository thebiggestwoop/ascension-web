export enum WeaponTag {
  Sword = 'sword',
  Axe = 'axe',
  Spear = 'spear',
  Bow = 'bow',
  Gauntlet = 'gauntlet',
  Spell = 'spell',
}

/** Fixed rules-text quality enum, reusable across weapons/armor/shields. */
export enum EquipmentQuality {
  Bulky = 'bulky',
  Burst = 'burst',
  CloseQuarters = 'close_quarters',
  Effortless = 'effortless',
  Extended = 'extended',
  Heavy = 'heavy',
  Knockback = 'knockback',
  Loading = 'loading',
  Parrying = 'parrying',
  Piercing = 'piercing',
  Reliable = 'reliable',
  Saddleback = 'saddleback',
  Subtle = 'subtle',
  Thrown = 'thrown',
  Concealing = 'concealing',
  Exhausting = 'exhausting',
  Overt = 'overt',
  Shield = 'shield',
}

/** Triggered by rolling an Effect [!] face on a Challenge Die; checked against an Effect Save. */
export enum DamageEffect {
  Daunting = 'daunting',
  Destructive = 'destructive',
  Draining = 'draining',
  Knockdown = 'knockdown',
  Persistent = 'persistent',
  Pinning = 'pinning',
  Provoking = 'provoking',
  Startling = 'startling',
  Stunning = 'stunning',
  Terrifying = 'terrifying',
}

export interface IQualityInstance {
  quality: EquipmentQuality
  /** Numeric value for qualities like Burst X / Reliable X / Thrown X. Omitted otherwise. */
  value?: number
}

/** "You may carry 5 items... Bulky items count as 2" (Chapter Seven) - shared by the builder's
 * EquipmentPicker and the Character Sheet's Inventory Slots display so the two can't drift. */
export const MAX_INVENTORY_SLOTS = 5

/** Bulky items cost 2 inventory slots; everything else costs 1. */
export function equipmentSlotCost(qualities: IQualityInstance[]): number {
  return qualities.some((q) => q.quality === EquipmentQuality.Bulky) ? 2 : 1
}

export interface IWeaponData {
  id: string
  name: string
  tag: WeaponTag
  /** Base [CD] count before adding the wielder's Damage Bonus (Skirmish). */
  damageCD: number
  damageEffects: DamageEffect[]
  hands: 1 | 2
  range?: string
  qualities: IQualityInstance[]
}

export interface IArmorData {
  id: string
  name: string
  resistance: number
  qualities: IQualityInstance[]
  /** Shields consume a hand; worn body armor does not (omitted). */
  hands?: 1 | 2
}

export interface IGeneralItemData {
  id: string
  name: string
  hands: 0 | 1 | 2
  qualities: IQualityInstance[]
  description: string
}

/** Reference text for a Weapon Tag, shown as a tooltip wherever the tag appears (e.g. "Sword"). */
export interface IWeaponTagDefinition {
  id: WeaponTag
  name: string
  description: string
}

/** Reference text for an Equipment Quality, shown as a tooltip wherever the quality appears (e.g. "Parrying"). */
export interface IEquipmentQualityDefinition {
  id: EquipmentQuality
  name: string
  description: string
}

/** Reference text for a Damage Effect, shown as a tooltip wherever it appears (e.g. "Knockdown"). */
export interface IDamageEffectDefinition {
  id: DamageEffect
  name: string
  description: string
}
