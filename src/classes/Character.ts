import { AttributeId, SkillId, SocialClassId, StatusId } from './enums'
import type { ISerializable } from './ISerializable'
import type { ITalentData } from './Talent'
import type { IArmorData, IGeneralItemData } from './Equipment'
import type { ICreationRecord, ILevelUpRecord } from './CharacterHistory'

export interface IValue {
  text: string
  /** Values get Challenged/Complied-with in play; a spent Value is inactive until refreshed. */
  active: boolean
}

export interface ITrait {
  name: string
  description?: string
}

export interface IActiveStatus {
  id: StatusId
  /** Free text duration, e.g. "until end of next turn". */
  duration: string
}

export interface ICharacterData {
  /** Stable id assigned when the draft is created; used as the Storage.ts key. */
  id: string
  name: string
  level: number
  xp: number

  attributes: Record<AttributeId, number>
  skills: Record<SkillId, number>
  focuses: string[]
  values: IValue[]
  traits: ITrait[]

  currentHp: number
  currentWillpower: number
  temporaryHp: number
  statuses: IActiveStatus[]

  determination: number

  talentIds: string[]
  equippedWeaponIds: string[]
  equippedArmorId?: string
  inventoryItemIds: string[]
  mountId?: string
  /** Spells currently prepared, by id; duplicate entries mean multiple copies of the same spell prepared. */
  preparedSpellIds: string[]

  /** Set from the Social Class / Career Lifepath stages; used to gate Talent prerequisites. */
  socialClassId?: SocialClassId
  careerId?: string

  /** Every choice made during Lifepath creation/Quick Build - not used by any getter, kept for
   * the player's own reference. Optional since characters saved before this field existed won't
   * have it. */
  creationRecord?: ICreationRecord
  /** Every completed Level Up, in order ascended - lets the character revert its most recent
   * Level Up by walking the last entry's grants back off. */
  levelUpHistory: ILevelUpRecord[]
}

/**
 * Passive bonuses to derived stats resolved from a character's held Talents and equipped
 * items. Not part of ICharacterData - it's derived from talentIds/equipment against the
 * rules content, so it's computed fresh via computeStatModifiers() rather than stored.
 */
export interface ICharacterStatModifiers {
  healthBarBonus?: number
  willpowerBonus?: number
  resistanceBonus?: number
  spellSlotBonus?: number
}

/**
 * Resolves a character's talentIds/equipment against the rules content to find passive stat
 * bonuses (e.g. Resilient 1's +2 Health Bar, an equipped Armor's Resistance). Pure function of
 * explicitly-passed content so src/classes stays free of ContentLoader/io imports - callers
 * (Vue components/stores, which already read CoreContent) resolve this and pass it to
 * Character's constructor or Deserialize.
 */
export function computeStatModifiers(
  data: Pick<ICharacterData, 'talentIds' | 'equippedArmorId' | 'inventoryItemIds'>,
  talents: ITalentData[],
  armor: IArmorData[],
  generalItems: IGeneralItemData[],
): ICharacterStatModifiers {
  const heldTalentIds = new Set(data.talentIds)
  let healthBarBonus = 0
  let willpowerBonus = 0
  for (const t of talents) {
    if (!heldTalentIds.has(t.id) || !t.passiveModifiers) continue
    healthBarBonus += t.passiveModifiers.healthBarBonus ?? 0
    willpowerBonus += t.passiveModifiers.willpowerBonus ?? 0
  }

  const resistanceBonus = armor.find((a) => a.id === data.equippedArmorId)?.resistance ?? 0

  /** "Each Tome you have grants 2 additional Spell Slots" (Gremorie 1 raises this to 3). */
  const tomeId = generalItems.find((g) => g.name === 'Tome')?.id
  const tomeCount = tomeId ? data.inventoryItemIds.filter((id) => id === tomeId).length : 0
  const spellSlotsPerTome = heldTalentIds.has('gremorie_1') ? 3 : 2
  const spellSlotBonus = tomeCount * spellSlotsPerTome

  return { healthBarBonus, willpowerBonus, resistanceBonus, spellSlotBonus }
}

/**
 * The core character domain model. Attributes/Skills/Focuses/Values/Traits are the
 * raw inputs (set during Lifepath or Standard Array creation); everything below is
 * derived per the Chapter Three formulas in the rules doc, plus any passive bonuses from
 * held Talents/equipped items resolved into `modifiers`.
 */
export class Character implements ISerializable<ICharacterData> {
  constructor(
    private data: ICharacterData,
    private modifiers: ICharacterStatModifiers = {},
  ) {}

  get name(): string {
    return this.data.name
  }

  get level(): number {
    return this.data.level
  }

  get talentIds(): string[] {
    return this.data.talentIds
  }

  attribute(id: AttributeId): number {
    return this.data.attributes[id]
  }

  skill(id: SkillId): number {
    return this.data.skills[id]
  }

  /** Speed = 3 + floor(Agility / 2) */
  get speed(): number {
    return 3 + Math.floor(this.attribute(AttributeId.Agility) / 2)
  }

  /** Health Bar = Brawn + Skirmish (+ passive Talent bonuses, e.g. Resilient 1's +2); Max HP = Health Bar x 3. */
  get healthBar(): number {
    return this.attribute(AttributeId.Brawn) + this.skill(SkillId.Skirmish) + (this.modifiers.healthBarBonus ?? 0)
  }

  get maxHp(): number {
    return this.healthBar * 3
  }

  /** Willpower pool == Faith rating (+ passive Talent bonuses, e.g. Fortified Mind 2's +3). */
  get maxWillpower(): number {
    return this.attribute(AttributeId.Faith) + (this.modifiers.willpowerBonus ?? 0)
  }

  /** Effect Save = floor(Attribute / 2) - 1, one per Attribute. */
  effectSave(id: AttributeId): number {
    return Math.floor(this.attribute(id) / 2) - 1
  }

  /** Damage Bonus (added as bonus [CD] to weapon/spell attacks) == Skirmish rating. */
  get damageBonus(): number {
    return this.skill(SkillId.Skirmish)
  }

  /** Damage subtracted before HP loss; comes entirely from equipped Armor. */
  get resistance(): number {
    return this.modifiers.resistanceBonus ?? 0
  }

  /** Spell Slots == Study rating, plus 2 (or 3, with Gremorie 1) per equipped Tome. */
  get spellSlots(): number {
    return this.skill(SkillId.Study) + (this.modifiers.spellSlotBonus ?? 0)
  }

  get isRattled(): boolean {
    return this.data.statuses.some((s) => s.id === StatusId.Rattled)
  }

  /**
   * Wounds are derived from current HP, not stored: Wound 1 at or below 2/3 Max HP (-2
   * Speed), Wound 2 at or below 1/3 Max HP (also can't take Swift Tasks). Several Dark
   * Domain spells (Penumbra, Umbra, Nox, Shadow Blade...) scale their damage per Wound.
   */
  get wounds(): 0 | 1 | 2 {
    if (this.data.currentHp <= this.healthBar) return 2
    if (this.data.currentHp <= this.healthBar * 2) return 1
    return 0
  }

  Serialize(): ICharacterData {
    return structuredClone(this.data)
  }

  static Deserialize(data: ICharacterData, modifiers?: ICharacterStatModifiers): Character {
    return new Character(structuredClone(data), modifiers)
  }
}
