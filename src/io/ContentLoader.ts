import type { IAttributeData } from '@/classes/Attribute'
import type { ISkillData } from '@/classes/Skill'
import type { ILifepathStageData, IFinishingTouchesData, IStandardArrayData } from '@/classes/Lifepath'
import type { IAdvancementData } from '@/classes/Advancement'
import type {
  IWeaponData,
  IArmorData,
  IGeneralItemData,
  IWeaponTagDefinition,
  IEquipmentQualityDefinition,
  IDamageEffectDefinition,
} from '@/classes/Equipment'
import type { IMountData } from '@/classes/Mount'
import type { ITalentData, ITalentGroupIndexEntry } from '@/classes/Talent'
import type { ISpellData } from '@/classes/Spell'
import type { IArchetypeCategoryData, IArchetypeCharacterData } from '@/classes/Archetype'

import attributesJson from '@content/attributes.json'
import skillsJson from '@content/skills.json'
import socialClassesJson from '@content/lifepath/social-classes.json'
import upbringingsJson from '@content/lifepath/upbringings.json'
import educationsJson from '@content/lifepath/educations.json'
import careersJson from '@content/lifepath/careers.json'
import lifeEventsJson from '@content/lifepath/life-events.json'
import finishingTouchesJson from '@content/lifepath/finishing-touches.json'
import standardArrayJson from '@content/standard-array.json'
import advancementJson from '@content/advancement.json'
import weaponsJson from '@content/equipment/weapons.json'
import armorJson from '@content/equipment/armor.json'
import shieldsJson from '@content/equipment/shields.json'
import mountsJson from '@content/equipment/mounts.json'
import generalItemsJson from '@content/equipment/general.json'
import weaponTagsJson from '@content/equipment/weapon-tags.json'
import qualitiesJson from '@content/equipment/qualities.json'
import damageEffectsJson from '@content/equipment/damage-effects.json'
import narrativeTalentsJson from '@content/talents/narrative.json'
import combatTalentsJson from '@content/talents/combat.json'
import talentIndexJson from '@content/talents/_index.json'
import arcaneSpellsJson from '@content/spells/arcane.json'
import lightSpellsJson from '@content/spells/light.json'
import darkSpellsJson from '@content/spells/dark.json'
import archetypeIndexJson from '@content/archetypes/_index.json'
import archetypeHeroJson from '@content/archetypes/sword/hero.json'
import archetypeTwinbladeJson from '@content/archetypes/sword/twinblade.json'
import archetypeSpellswordJson from '@content/archetypes/sword/spellsword.json'
import archetypeCavalierJson from '@content/archetypes/spear/cavalier.json'
import archetypeCataphractJson from '@content/archetypes/spear/cataphract.json'
import archetypePaladinJson from '@content/archetypes/spear/paladin.json'
import archetypeMendicantJson from '@content/archetypes/light_magick/mendicant.json'
import archetypeBishopJson from '@content/archetypes/authority/Bishop.json'
import archetypeLordJson from '@content/archetypes/authority/Lord.json'
import archetypeStrategistJson from '@content/archetypes/authority/Strategist.json'
import archetypeDeathKnightJson from '@content/archetypes/axe/Death-Knight.json'
import archetypeGuardianJson from '@content/archetypes/axe/Guardian.json'
import archetypeWarriorJson from '@content/archetypes/axe/Warrior.json'
import archetypeFulgermancerJson from '@content/archetypes/arcane_magick/Fulgermancer.json'
import archetypeShadowCallerJson from '@content/archetypes/dark_magick/Shadow-Caller.json'
import archetypeHeavyBowmanJson from '@content/archetypes/bow/Heavy-Bowman.json'
import archetypeOutriderJson from '@content/archetypes/bow/Outrider.json'
import archetypeRangerJson from '@content/archetypes/bow/Ranger.json'

/**
 * Central place the rest of the app pulls rules content from. Right now this reads the
 * bundled JSON directly; if/when a homebrew content-pack format is added (see Phase 8 of
 * the project roadmap), this is the module that would merge core + active packs instead.
 */
export const CoreContent = {
  attributes: attributesJson as IAttributeData[],
  skills: skillsJson as ISkillData[],
  lifepath: {
    socialClass: socialClassesJson as ILifepathStageData,
    upbringing: upbringingsJson as ILifepathStageData,
    education: educationsJson as ILifepathStageData,
    career: careersJson as ILifepathStageData,
    lifeEvents: lifeEventsJson as ILifepathStageData,
    finishingTouches: finishingTouchesJson as IFinishingTouchesData,
  },
  standardArray: standardArrayJson as IStandardArrayData,
  advancement: advancementJson as IAdvancementData,
  equipment: {
    weapons: weaponsJson as IWeaponData[],
    armor: armorJson as IArmorData[],
    shields: shieldsJson as IArmorData[],
    mounts: mountsJson as IMountData[],
    general: generalItemsJson as IGeneralItemData[],
    weaponTags: weaponTagsJson as IWeaponTagDefinition[],
    qualities: qualitiesJson as IEquipmentQualityDefinition[],
    damageEffects: damageEffectsJson as IDamageEffectDefinition[],
  },
  talents: {
    narrative: narrativeTalentsJson as ITalentData[],
    combat: combatTalentsJson as ITalentData[],
    /** All 15 Archetypes + 49 Talent Trees by name/prerequisite; most await full ability transcription. */
    index: talentIndexJson as ITalentGroupIndexEntry[],
  },
  spells: {
    arcane: arcaneSpellsJson as ISpellData[],
    light: lightSpellsJson as ISpellData[],
    dark: darkSpellsJson as ISpellData[],
  },
  archetypes: {
    categories: archetypeIndexJson as IArchetypeCategoryData[],
    /** Keyed by the archetype id used in _index.json - add an entry here whenever a new
     * content/archetypes/<category>/<id>.json pregen is added. */
    characters: {
      hero: archetypeHeroJson as IArchetypeCharacterData,
      twinblade: archetypeTwinbladeJson as IArchetypeCharacterData,
      spellsword: archetypeSpellswordJson as IArchetypeCharacterData,
      cavalier: archetypeCavalierJson as IArchetypeCharacterData,
      cataphract: archetypeCataphractJson as IArchetypeCharacterData,
      paladin: archetypePaladinJson as IArchetypeCharacterData,
      mendicant: archetypeMendicantJson as IArchetypeCharacterData,
      bishop: archetypeBishopJson as IArchetypeCharacterData,
      lord: archetypeLordJson as IArchetypeCharacterData,
      strategist: archetypeStrategistJson as IArchetypeCharacterData,
      death_knight: archetypeDeathKnightJson as IArchetypeCharacterData,
      guardian: archetypeGuardianJson as IArchetypeCharacterData,
      warrior: archetypeWarriorJson as IArchetypeCharacterData,
      fulgermancer: archetypeFulgermancerJson as IArchetypeCharacterData,
      shadow_caller: archetypeShadowCallerJson as IArchetypeCharacterData,
      heavy_bowman: archetypeHeavyBowmanJson as IArchetypeCharacterData,
      outrider: archetypeOutriderJson as IArchetypeCharacterData,
      ranger: archetypeRangerJson as IArchetypeCharacterData,
    } as Record<string, IArchetypeCharacterData>,
  },
}
