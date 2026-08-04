import { AttributeId, SkillId, StatusId } from './enums'
import type { ISerializable } from './ISerializable'
import type { ITalentData } from './Talent'
import type { IArmorData, IGeneralItemData } from './Equipment'
import type { ICreationRecord, ILevelUpRecord } from './CharacterHistory'
import type { ISpellData } from './Spell'
import { MAGICK_ATTRIBUTE_BY_DOMAIN } from './Spell'

export interface IValue {
  text: string
  /** "Called upon" (spent to grant an advantage) - inactive until refreshed, e.g. at the start
   * of the next session. Distinct from `challenged` below: a called-upon Value comes back, a
   * challenged one doesn't until deliberately recovered. */
  active: boolean
  /** "Challenged" per Chapter Three: crossed out on the sheet and unusable until recovered (see
   * "Recovering Values"), in exchange for a point of Determination - a longer-lived state than
   * simply being called upon. */
  challenged: boolean
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
  /** "Each party should have a Common Cause, an agreed upon directive which defines the
   * characters' general goal or goals" (Chapter Three) - a fifth, party-wide Value: same
   * Called Upon/Challenged mechanics as `values` above, but tracked as its own field (not a
   * 5th array entry) since it's conceptually distinct and always exactly one. Blank until the
   * party agrees on one in play; not part of any creation flow's grants. */
  commonCause: IValue
  traits: ITrait[]
  /** Skills chosen as "Combat Focuses" (optional rule): grants an expanded crit range on Tasks
   * using that Skill in combat instead of relying on written Focuses. Two chosen at character
   * creation, a third at Level 6 - see Advancement's `thirdCombatFocusUnlockLevel`. */
  combatSkillFocuses: SkillId[]

  currentHp: number
  currentWillpower: number
  temporaryHp: number
  statuses: IActiveStatus[]

  /** Temporary Resistance from a buff/spell/etc., on top of equipped Armor's Resistance -
   * player-entered, 0-5. */
  temporaryResistance: number

  determination: number

  /** Player-entered flat modifier (-10 to 10) applied to every Speed value (Speed, Mounted
   * Speed, Flying Speed) - the Character Sheet's "Bonus/Penalty" field. Exists because Speed
   * buffs/penalties (e.g. Aura of Speed's "+2 speed while X") often depend on turn order/Range
   * this app doesn't simulate, so rather than guessing when they apply, the field is simply
   * editable - see updatePreparedSpells' Aura of Speed prepopulation for the one case that
   * seeds a starting value automatically. */
  speedBonus: number

  talentIds: string[]
  equippedWeaponIds: string[]
  equippedArmorId?: string
  inventoryItemIds: string[]
  mountId?: string
  /** Spells currently prepared, by id; duplicate entries mean multiple copies of the same spell prepared. */
  preparedSpellIds: string[]
  /** General items (see IGeneralItemData.healsHealthBars) currently marked "used" via the
   * Character Sheet's Use/Reset buttons - by item id, not per stacked copy, so using one
   * Healing Potion greys out every copy of it until Reset. */
  usedGeneralItemIds: string[]

  /** Set from the Career Lifepath stage; used to gate Talent prerequisites. */
  careerId?: string

  /** Every choice made during Lifepath creation/Quick Build - not used by any getter, kept for
   * the player's own reference. Optional since characters saved before this field existed won't
   * have it. */
  creationRecord?: ICreationRecord
  /** Every completed Level Up, in order ascended - lets the character revert its most recent
   * Level Up by walking the last entry's grants back off. */
  levelUpHistory: ILevelUpRecord[]

  /** Freeform player notes, entered as simple Markdown. */
  notes: string
}

/**
 * Backfills fields added after a character may have been saved (loaded from IndexedDB, or an
 * imported export file from an older version of the app) - each check mirrors the field's own
 * "optional since older saves won't have it" doc comment on ICharacterData. Mutates and returns
 * the same object for convenient chaining at a call site.
 */
export function migrateLegacyCharacterData(data: ICharacterData): ICharacterData {
  if (!data.levelUpHistory) data.levelUpHistory = []
  if (data.temporaryResistance === undefined) data.temporaryResistance = 0
  if (!data.combatSkillFocuses) data.combatSkillFocuses = []
  if (data.notes === undefined) data.notes = ''
  if (data.commonCause === undefined) data.commonCause = { text: '', active: true, challenged: false }
  for (const value of data.values) {
    if (value.challenged === undefined) value.challenged = false
  }
  if (!data.usedGeneralItemIds) data.usedGeneralItemIds = []
  if (data.speedBonus === undefined) data.speedBonus = 0
  return data
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
  /** Angel's Wings (light 3): Flying Speed = Half the caster's Magick Attribute, while
   * prepared. Undefined (not 0) when not prepared, so callers can hide the stat entirely
   * rather than showing a Flying Speed of 0. */
  flyingSpeed?: number
}

/** Wound 1 at or below 2/3 Max HP, Wound 2 at or below 1/3 Max HP - shared by Character's own
 * `wounds` getter and computeStatModifiers (Court Death's Resistance floor needs a caster's
 * Wounds before a Character instance exists to ask it). */
export function computeWoundsFromHp(currentHp: number, healthBar: number): 0 | 1 | 2 {
  if (currentHp <= healthBar) return 2
  if (currentHp <= healthBar * 2) return 1
  return 0
}

/**
 * Resolves a character's talentIds/equipment/prepared Spells against the rules content to
 * find passive stat bonuses (e.g. Resilient 1's +2 Health Bar, an equipped Armor's
 * Resistance, Armis Arcane's conditional Resistance). Pure function of explicitly-passed
 * content so src/classes stays free of ContentLoader/io imports - callers (Vue components/
 * stores, which already read CoreContent) resolve this and pass it to Character's
 * constructor or Deserialize.
 *
 * `preparedSpellIds`/`attributes`/`skills`/`currentHp` are optional (unlike the required
 * `talentIds`/`equippedArmorId`/`inventoryItemIds`) since a couple of call sites only need
 * this for spellSlotBonus against an in-progress, not-yet-a-real-character draft (see
 * FinishingTouchesStep/QuickBuildStep's previewSpellSlots) - omitting them just skips every
 * Spell-based modifier below rather than requiring a fully-formed character to call this at all.
 */
export function computeStatModifiers(
  data: Pick<ICharacterData, 'talentIds' | 'equippedArmorId' | 'inventoryItemIds'> &
    Partial<Pick<ICharacterData, 'preparedSpellIds' | 'attributes' | 'skills' | 'currentHp'>>,
  talents: ITalentData[],
  armor: IArmorData[],
  generalItems: IGeneralItemData[],
  spells: ISpellData[] = [],
  shields: IArmorData[] = [],
): ICharacterStatModifiers {
  const heldTalentIds = new Set(data.talentIds)
  let healthBarBonus = 0
  let willpowerBonus = 0
  for (const t of talents) {
    if (!heldTalentIds.has(t.id) || !t.passiveModifiers) continue
    healthBarBonus += t.passiveModifiers.healthBarBonus ?? 0
    willpowerBonus += t.passiveModifiers.willpowerBonus ?? 0
  }

  let resistanceBonus = armor.find((a) => a.id === data.equippedArmorId)?.resistance ?? 0

  const preparedSpellIds = new Set(data.preparedSpellIds ?? [])
  const hasArmorEquipped = !!data.equippedArmorId
  const hasShieldEquipped = shields.some((s) => data.inventoryItemIds.includes(s.id))

  /** Armis Arcane (arcane 1): "you have 2 Resistance while unarmored and not wielding a
   * Shield," as long as prepared - a floor, not additive (armor's own Resistance is always 0
   * in that state anyway, since the condition requires no armor equipped). */
  if (preparedSpellIds.has('armis_arcane') && !hasArmorEquipped && !hasShieldEquipped) {
    resistanceBonus = Math.max(resistanceBonus, 2)
  }

  /** Court Death (dark 2): "resistance increases to a minimum of 3 if you have 1 Wound, and
   * to a minimum of 5 if you have 2 Wounds" - needs the caster's own Wounds, computed here
   * directly (currentHp vs. healthBar, itself already including healthBarBonus above) rather
   * than via a Character instance, which doesn't exist yet at this point. */
  if (preparedSpellIds.has('court_death') && data.attributes && data.skills && data.currentHp !== undefined) {
    const healthBar = data.attributes[AttributeId.Brawn] + data.skills[SkillId.Skirmish] + healthBarBonus
    const wounds = computeWoundsFromHp(data.currentHp, healthBar)
    if (wounds === 2) resistanceBonus = Math.max(resistanceBonus, 5)
    else if (wounds === 1) resistanceBonus = Math.max(resistanceBonus, 3)
  }

  /** Angel's Wings (light 3): "granting you a Flying speed of Half your Magick," as long as
   * prepared - "Magick" is the caster's Magick Attribute for the spell's own domain (Faith,
   * since Angel's Wings is a Light Domain spell). */
  let flyingSpeed: number | undefined
  if (preparedSpellIds.has('angels_wings') && data.attributes) {
    const angelsWings = spells.find((s) => s.id === 'angels_wings')
    if (angelsWings) flyingSpeed = Math.floor(data.attributes[MAGICK_ATTRIBUTE_BY_DOMAIN[angelsWings.domain]] / 2)
  }

  /** "Each Tome you have grants 2 additional Spell Slots" (Gremorie 1 raises this to 3). */
  const tomeId = generalItems.find((g) => g.name === 'Tome')?.id
  const tomeCount = tomeId ? data.inventoryItemIds.filter((id) => id === tomeId).length : 0
  const spellSlotsPerTome = heldTalentIds.has('gremorie_1') ? 3 : 2
  const spellSlotBonus = tomeCount * spellSlotsPerTome

  return { healthBarBonus, willpowerBonus, resistanceBonus, spellSlotBonus, flyingSpeed }
}

/**
 * The minimal slice of Character that spell-text rendering needs (SpellEffectText's live
 * computed-value badges) - lets the character builder, which has Attributes/Skills but no
 * full ICharacterData/Character instance yet, satisfy the same prop with a plain object
 * instead of fabricating a fake full character just to construct one. A real `Character`
 * already structurally satisfies this.
 */
export interface ICharacterStatSource {
  attribute(id: AttributeId): number
  skill(id: SkillId): number
  wounds: 0 | 1 | 2
}

/**
 * The core character domain model. Attributes/Skills/Focuses/Values/Traits are the
 * raw inputs (set during Lifepath or Standard Array creation); everything below is
 * derived per the Chapter Three formulas in the rules doc, plus any passive bonuses from
 * held Talents/equipped items resolved into `modifiers`.
 */
export class Character implements ISerializable<ICharacterData>, ICharacterStatSource {
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

  /** Speed = 3 + floor(Agility / 2), plus the player-entered Bonus/Penalty field. */
  get speed(): number {
    return 3 + Math.floor(this.attribute(AttributeId.Agility) / 2) + this.data.speedBonus
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

  /** Damage subtracted before HP loss - from equipped Armor, plus any conditional passive
   * Spell bonus that currently applies (e.g. Armis Arcane, Court Death - see
   * computeStatModifiers). */
  get resistance(): number {
    return this.modifiers.resistanceBonus ?? 0
  }

  /** Angel's Wings (light 3), while prepared: Flying Speed = Half Magick, plus the
   * player-entered Bonus/Penalty field (see ICharacterData.speedBonus). Undefined (not 0)
   * when not prepared - callers should hide the tile entirely rather than showing 0. */
  get flyingSpeed(): number | undefined {
    return this.modifiers.flyingSpeed !== undefined ? this.modifiers.flyingSpeed + this.data.speedBonus : undefined
  }

  get temporaryResistance(): number {
    return this.data.temporaryResistance
  }

  /** Armor's Resistance plus any Temporary Resistance from a buff/spell/etc. */
  get totalResistance(): number {
    return this.resistance + this.temporaryResistance
  }

  /** Spell Slots == Study rating, plus 2 (or 3, with Gremorie 1) per equipped Tome. */
  get spellSlots(): number {
    return this.skill(SkillId.Study) + (this.modifiers.spellSlotBonus ?? 0)
  }

  /**
   * "If a Character's Willpower reaches 0, they are Rattled... A character can clear Rattled
   * as soon as any amount of Willpower is restored" - derived from currentWillpower, not
   * stored, the same way Wounds are derived from currentHp rather than tracked as a status.
   */
  get isRattled(): boolean {
    return this.data.currentWillpower <= 0
  }

  /**
   * Wounds are derived from current HP, not stored: Wound 1 at or below 2/3 Max HP (-2
   * Speed), Wound 2 at or below 1/3 Max HP (also can't take Swift Tasks). Several Dark
   * Domain spells (Penumbra, Umbra, Nox, Shadow Blade...) scale their damage per Wound.
   */
  get wounds(): 0 | 1 | 2 {
    return computeWoundsFromHp(this.data.currentHp, this.healthBar)
  }

  Serialize(): ICharacterData {
    return structuredClone(this.data)
  }

  static Deserialize(data: ICharacterData, modifiers?: ICharacterStatModifiers): Character {
    return new Character(structuredClone(data), modifiers)
  }
}
