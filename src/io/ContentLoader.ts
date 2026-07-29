import type { IAttributeData } from '@/classes/Attribute'
import type { ISkillData } from '@/classes/Skill'
import type { ILifepathStageData, IFinishingTouchesData, IStandardArrayData } from '@/classes/Lifepath'
import type { IAdvancementData } from '@/classes/Advancement'
import type { IWeaponData, IArmorData, IGeneralItemData } from '@/classes/Equipment'
import type { ITalentData } from '@/classes/Talent'
import type { ISpellData } from '@/classes/Spell'

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
    general: generalItemsJson as IGeneralItemData[],
    // shields, mounts are pending further Phase 1 data entry
  },
  talents: {
    narrative: narrativeTalentsJson as ITalentData[],
    combat: combatTalentsJson as ITalentData[],
  },
  spells: {
    arcane: arcaneSpellsJson as ISpellData[],
    // light, dark domains are pending further Phase 1 data entry
  },
}
