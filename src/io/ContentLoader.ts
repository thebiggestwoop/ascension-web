import type { IAttributeData } from '@/classes/Attribute'
import type { ISkillData } from '@/classes/Skill'
import type { ILifepathStageData } from '@/classes/Lifepath'
import type { IWeaponData, IArmorData, IGeneralItemData } from '@/classes/Equipment'
import type { ITalentData } from '@/classes/Talent'
import type { ISpellData } from '@/classes/Spell'

import attributesJson from '@content/attributes.json'
import skillsJson from '@content/skills.json'
import socialClassesJson from '@content/lifepath/social-classes.json'
import weaponsJson from '@content/equipment/weapons.json'
import armorJson from '@content/equipment/armor.json'
import generalItemsJson from '@content/equipment/general.json'
import narrativeTalentsJson from '@content/talents/narrative.json'
import combatTalentsJson from '@content/talents/combat.json'
import arcaneSpellsJson from '@content/spells/arcane.json'

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
    // upbringing, education, career, lifeEvents stages are seeded stubs pending Phase 1 data entry
  },
  equipment: {
    weapons: weaponsJson as IWeaponData[],
    armor: armorJson as IArmorData[],
    general: generalItemsJson as IGeneralItemData[],
  },
  talents: {
    narrative: narrativeTalentsJson as ITalentData[],
    combat: combatTalentsJson as ITalentData[],
  },
  spells: {
    arcane: arcaneSpellsJson as ISpellData[],
    // light, dark domains are pending Phase 1 data entry
  },
}
