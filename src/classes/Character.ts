import { AttributeId, SkillId, StatusId } from './enums'
import type { ISerializable } from './ISerializable'

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
}

/**
 * The core character domain model. Attributes/Skills/Focuses/Values/Traits are the
 * raw inputs (set during Lifepath or Standard Array creation); everything below is
 * derived per the Chapter Three formulas in the rules doc.
 */
export class Character implements ISerializable<ICharacterData> {
  constructor(private data: ICharacterData) {}

  get name(): string {
    return this.data.name
  }

  get level(): number {
    return this.data.level
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

  /** Health Bar = Brawn + Skirmish; there are three Health Bars, so Max HP = Health Bar x 3. */
  get healthBar(): number {
    return this.attribute(AttributeId.Brawn) + this.skill(SkillId.Skirmish)
  }

  get maxHp(): number {
    return this.healthBar * 3
  }

  /** Willpower pool == Faith rating. */
  get maxWillpower(): number {
    return this.attribute(AttributeId.Faith)
  }

  /** Effect Save = floor(Attribute / 2) - 1, one per Attribute. */
  effectSave(id: AttributeId): number {
    return Math.floor(this.attribute(id) / 2) - 1
  }

  /** Damage Bonus (added as bonus [CD] to weapon/spell attacks) == Skirmish rating. */
  get damageBonus(): number {
    return this.skill(SkillId.Skirmish)
  }

  get isRattled(): boolean {
    return this.data.statuses.some((s) => s.id === StatusId.Rattled)
  }

  Serialize(): ICharacterData {
    return structuredClone(this.data)
  }

  static Deserialize(data: ICharacterData): Character {
    return new Character(structuredClone(data))
  }
}
