import { toRaw } from 'vue'
import type { ICharacterData } from '@/classes/Character'
import { Character, computeStatModifiers, migrateLegacyCharacterData } from '@/classes/Character'
import { AttributeId, SkillId, TalentCategory } from '@/classes/enums'
import { WeaponTag, type IQualityInstance, type IWeaponData } from '@/classes/Equipment'
import { mountedSpeed } from '@/classes/Mount'
import { resolveMagickDomainAccess, MAGICK_ATTRIBUTE_BY_DOMAIN } from '@/classes/Spell'
import type { ISpellData } from '@/classes/Spell'
import { CoreContent } from './ContentLoader'
import { sanitizeFilename } from './CharacterTransfer'

/**
 * A plain-text, at-a-glance summary of a character - everything needed to tell what they can
 * do without reading the raw JSON export, in a format that pastes cleanly into a Discord code
 * block (same idea as COMP/CON's "raw text statblock" export for LANCER pilots/mechs).
 */

const WEAPON_TAG_ATTRIBUTES: Partial<Record<WeaponTag, AttributeId[]>> = {
  [WeaponTag.Sword]: [AttributeId.Agility],
  [WeaponTag.Axe]: [AttributeId.Brawn],
  [WeaponTag.Spear]: [AttributeId.Coordination],
  [WeaponTag.Bow]: [AttributeId.Awareness],
  [WeaponTag.Gauntlet]: [AttributeId.Agility, AttributeId.Brawn, AttributeId.Coordination],
}

function attributeName(id: AttributeId): string {
  return CoreContent.attributes.find((a) => a.id === id)?.name ?? id
}
function skillName(id: SkillId): string {
  return CoreContent.skills.find((s) => s.id === id)?.name ?? id
}

function qualityLabel(q: IQualityInstance): string {
  const label = q.quality
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
  return q.value !== undefined ? `${label} ${q.value}` : label
}
function qualityList(qualities: IQualityInstance[]): string {
  return qualities.map(qualityLabel).join(', ')
}

function weaponTaskText(weapon: IWeaponData, character: Character): string {
  const attrs = WEAPON_TAG_ATTRIBUTES[weapon.tag]
  if (!attrs) return '-'
  return attrs.map((id) => `${attributeName(id)} ${character.attribute(id) + character.skill(SkillId.Skirmish)}`).join('/')
}

function countOccurrences(ids: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1
  return counts
}

/** Same explanation the character sheet's Resistance tooltip shows (see index.vue's own
 * activeResistanceSpellNotes) - which passive Spell(s), if any, are currently contributing. */
function activeResistanceSpellNotes(data: ICharacterData, character: Character): string[] {
  const prepared = new Set(data.preparedSpellIds)
  const hasShield = CoreContent.equipment.shields.some((s) => data.inventoryItemIds.includes(s.id))
  const notes: string[] = []
  if (prepared.has('armis_arcane') && !data.equippedArmorId && !hasShield) {
    notes.push('Armis Arcane (2 Resistance while unarmored, no Shield)')
  }
  if (prepared.has('court_death')) {
    if (character.wounds === 2) notes.push('Court Death (Resistance minimum 5 at Wound 2)')
    else if (character.wounds === 1) notes.push('Court Death (Resistance minimum 3 at Wound 1)')
  }
  return notes
}

function line(label: string, value: string, indent = '  '): string {
  return `${indent}${label}: ${value}`
}

const SECTION_RULE = '-'.repeat(60)
const TITLE_RULE = '='.repeat(60)

export function generateStatblockText(data: ICharacterData): string {
  // toRaw() unwraps a reactive Pinia Proxy (structuredClone can't clone one directly) - see
  // the same pattern in CharacterDraftStore/CharacterSheetStore before Character.Deserialize.
  const migrated = migrateLegacyCharacterData(structuredClone(toRaw(data)))
  const allTalents = [...CoreContent.talents.narrative, ...CoreContent.talents.combat]
  const allSpells = [...CoreContent.spells.arcane, ...CoreContent.spells.light, ...CoreContent.spells.dark]
  const modifiers = computeStatModifiers(
    migrated,
    allTalents,
    CoreContent.equipment.armor,
    CoreContent.equipment.general,
    allSpells,
    CoreContent.equipment.shields,
    CoreContent.equipment.weapons,
  )
  const character = new Character(migrated, modifiers)

  const out: string[] = []
  out.push(TITLE_RULE)
  out.push((migrated.name || 'Unnamed Character').toUpperCase())
  out.push(`Level ${migrated.level} | XP ${migrated.xp}/${CoreContent.advancement.xpThresholdPerLevel}`)
  out.push(TITLE_RULE)
  out.push('')

  out.push('ATTRIBUTES')
  for (const attr of CoreContent.attributes) {
    const id = attr.id as AttributeId
    out.push(line(attr.name, `${character.attribute(id)} (Save ${character.effectSave(id)})`))
  }
  out.push('')

  out.push('SKILLS')
  for (const skill of CoreContent.skills) {
    const id = skill.id as SkillId
    const focus = migrated.combatSkillFocuses.includes(id) ? ' [Combat Focus]' : ''
    out.push(line(skill.name, `${character.skill(id)}${focus}`))
  }
  out.push('')

  out.push('CORE STATS')
  out.push(line('HP', `${migrated.currentHp} / ${character.maxHp} (Temp HP: ${migrated.temporaryHp})`))
  out.push(line('Willpower', `${migrated.currentWillpower} / ${character.maxWillpower}${character.isRattled ? ' (RATTLED)' : ''}`))
  const resistanceNotes = activeResistanceSpellNotes(migrated, character)
  out.push(
    line(
      'Resistance',
      `${character.resistance} (Temp: ${character.temporaryResistance}, Total: ${character.totalResistance})${resistanceNotes.length ? ` - ${resistanceNotes.join('; ')}` : ''}`,
    ),
  )
  const woundPenalty = character.wounds >= 1 ? 2 : 0
  const exhaustingNote = modifiers.exhaustingSpeedPenalty ? ` (-${modifiers.exhaustingSpeedPenalty} Exhausting equipment)` : ''
  out.push(line('Speed', `${character.speed - woundPenalty}${exhaustingNote}`))
  if (migrated.mountId) {
    const mount = CoreContent.equipment.mounts.find((m) => m.id === migrated.mountId)
    if (mount) {
      const speed =
        mountedSpeed(mount, character.attribute(mount.ridingAttribute)) +
        migrated.speedBonus -
        woundPenalty -
        (modifiers.exhaustingSpeedPenalty ?? 0)
      out.push(line('Mounted Speed', `${speed} (${mount.name})`))
    }
  }
  if (character.flyingSpeed !== undefined) {
    out.push(line('Flying Speed', `${character.flyingSpeed - woundPenalty}`))
  }
  out.push(line('Damage Bonus', `+${character.damageBonus}`))
  out.push(line('Spell Slots', `${character.spellSlots}`))
  out.push(line('Determination', `${migrated.determination} / 3`))
  if (character.wounds === 1) out.push(line('Wound Status', 'Wound 1 - Speed reduced by 2'))
  else if (character.wounds === 2) out.push(line('Wound Status', 'Wound 2 - Speed reduced by 2, cannot take Swift Tasks'))
  out.push('')

  out.push(SECTION_RULE)
  out.push('EQUIPMENT')
  out.push('')
  out.push('Weapons:')
  const weaponCounts = countOccurrences(migrated.equippedWeaponIds)
  const weaponEntries = Object.entries(weaponCounts)
    .map(([id, count]) => ({ weapon: CoreContent.equipment.weapons.find((w) => w.id === id), count }))
    .filter((e): e is { weapon: IWeaponData; count: number } => !!e.weapon)
  if (!weaponEntries.length) out.push('  None equipped')
  for (const e of weaponEntries) {
    const nameText = e.count > 1 ? `${e.weapon.name} x${e.count}` : e.weapon.name
    const damage = `${e.weapon.damageCD + character.damageBonus}[CD] (Base ${e.weapon.damageCD} + Skirmish ${character.damageBonus})`
    const qualities = qualityList(e.weapon.qualities)
    out.push(`  - ${nameText} | Task: ${weaponTaskText(e.weapon, character)} | Damage: ${damage}${qualities ? ` | ${qualities}` : ''}`)
  }
  out.push('')
  out.push('Armor:')
  const armor = migrated.equippedArmorId ? CoreContent.equipment.armor.find((a) => a.id === migrated.equippedArmorId) : undefined
  if (armor) {
    const qualities = qualityList(armor.qualities)
    out.push(`  ${armor.name} (Resistance ${armor.resistance})${qualities ? ` [${qualities}]` : ''}`)
  } else {
    out.push('  None equipped')
  }
  out.push('')
  out.push('Inventory:')
  const allInventoryItems = [...CoreContent.equipment.shields, ...CoreContent.equipment.general]
  const inventoryCounts = countOccurrences(migrated.inventoryItemIds)
  const inventoryEntries = Object.entries(inventoryCounts)
    .map(([id, count]) => ({ item: allInventoryItems.find((i) => i.id === id), count }))
    .filter((e): e is { item: (typeof allInventoryItems)[number]; count: number } => !!e.item)
  if (!inventoryEntries.length) out.push('  Empty')
  for (const e of inventoryEntries) {
    const nameText = e.count > 1 ? `${e.item.name} x${e.count}` : e.item.name
    const used = migrated.usedGeneralItemIds.includes(e.item.id) ? ' [USED]' : ''
    const qualities = qualityList(e.item.qualities)
    out.push(`  - ${nameText}${used}${qualities ? ` [${qualities}]` : ''}`)
  }
  if (migrated.mountId) {
    const mount = CoreContent.equipment.mounts.find((m) => m.id === migrated.mountId)
    if (mount) {
      out.push('')
      out.push('Mount:')
      out.push(`  ${mount.name} (Riding: ${attributeName(mount.ridingAttribute)})`)
    }
  }
  out.push('')

  out.push(SECTION_RULE)
  out.push('TALENTS')
  const heldTalents = allTalents.filter((t) => migrated.talentIds.includes(t.id))
  const narrativeTalents = heldTalents.filter((t) => t.category === TalentCategory.Narrative)
  const combatTalents = heldTalents.filter((t) => t.category === TalentCategory.Combat)
  out.push('')
  out.push('Narrative:')
  if (!narrativeTalents.length) out.push('  None')
  for (const t of narrativeTalents) out.push(`  - ${t.name} (${t.group})`)
  out.push('')
  out.push('Combat:')
  if (!combatTalents.length) out.push('  None')
  for (const t of combatTalents) out.push(`  - ${t.name} (${t.group}${t.tier ? `, Tier ${t.tier}` : ''})`)
  out.push('')

  const domainAccess = resolveMagickDomainAccess(migrated.talentIds)
  if (domainAccess.length) {
    out.push(SECTION_RULE)
    const usedSlots = migrated.preparedSpellIds.reduce((sum, id) => {
      const spell = allSpells.find((s) => s.id === id)
      return sum + (spell?.slotCost ?? 0)
    }, 0)
    out.push(`SPELLS PREPARED (${usedSlots} / ${character.spellSlots} Slots)`)
    const spellCounts = countOccurrences(migrated.preparedSpellIds)
    const spellEntries = Object.entries(spellCounts)
      .map(([id, count]) => ({ spell: allSpells.find((s) => s.id === id), count }))
      .filter((e): e is { spell: ISpellData; count: number } => !!e.spell)
    if (!spellEntries.length) out.push('  None prepared')
    for (const e of spellEntries) {
      const nameText = e.count > 1 ? `${e.spell.name} x${e.count}` : e.spell.name
      const domainLabel = `${e.spell.domain[0].toUpperCase()}${e.spell.domain.slice(1)}`
      let taskText = ''
      if (e.spell.task) {
        const attrId = MAGICK_ATTRIBUTE_BY_DOMAIN[e.spell.domain]
        const attrValue = character.attribute(attrId)
        const skillValue = character.skill(e.spell.task.skill)
        // Spelled out in full (unlike the app's own "Task: Faith <13>" badge, which relies on
        // a hover tooltip for this breakdown) since plain text has no hover to fall back on.
        taskText = ` - Task: ${attributeName(attrId)} ${attrValue} + ${skillName(e.spell.task.skill)} ${skillValue} = ${attrValue + skillValue}`
      }
      const usesText =
        e.spell.usesPerScene === 'passive' ? 'Passive' : `${e.spell.usesPerScene * e.count} / scene`
      out.push(`  - ${nameText} (${domainLabel}, Tier ${e.spell.tier})${taskText} - Uses: ${usesText}`)
    }
    out.push('')
  }

  out.push(SECTION_RULE)
  out.push('FOCUSES')
  out.push(`  ${migrated.focuses.length ? migrated.focuses.join(', ') : 'None'}`)
  out.push('')
  out.push('VALUES')
  for (const v of migrated.values) {
    const status = v.challenged ? ' [CHALLENGED]' : !v.active ? ' [Called Upon]' : ''
    out.push(`  - ${v.text || '(blank)'}${status}`)
  }
  if (migrated.commonCause.text) {
    const status = migrated.commonCause.challenged ? ' [CHALLENGED]' : !migrated.commonCause.active ? ' [Called Upon]' : ''
    out.push(`  - Common Cause: ${migrated.commonCause.text}${status}`)
  }
  out.push('')
  out.push('TRAITS')
  out.push(`  ${migrated.traits.length ? migrated.traits.map((t) => t.name).join(', ') : 'None'}`)
  out.push('')

  out.push(TITLE_RULE)
  out.push('Generated by Ascension Web - heroclub.app/ascension-web')
  out.push(TITLE_RULE)

  return out.join('\n')
}

/** Downloads the statblock as a standalone .txt file - same download mechanism as
 * exportCharacterToFile(), just a different content type and extension. */
export function downloadStatblock(data: ICharacterData): void {
  const text = generateStatblockText(data)
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(data.name)}-statblock.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
