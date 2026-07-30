<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { EquipmentQuality, WeaponTag } from '@/classes/Equipment'
import type { IQualityInstance, IWeaponData } from '@/classes/Equipment'
import TooltipChip from '@/ui/TooltipChip.vue'
import QuantityStepper from '@/ui/QuantityStepper.vue'
import DerivedValueBadge from '@/ui/DerivedValueBadge.vue'

const MAX_SLOTS = 5

/**
 * Equipping the same item more than once is meaningful in Ascension (dual-wielding two
 * identical weapons, carrying multiple Tomes for extra Spell Slots, etc.), so weapons and
 * inventory items (shields + general) are tracked as per-item counts rather than a picked/
 * not-picked set. Armor and Mount stay single-select - only one of each can be worn/ridden.
 * Weapons are further grouped one dropdown per Weapon Tag (Sword/Axe/Spear/Bow/Gauntlet) -
 * each dropdown defaults to "None", so a character is never forced into owning all five.
 */
const props = withDefaults(
  defineProps<{
    initialEquippedWeaponIds?: string[]
    initialEquippedArmorId?: string
    initialInventoryItemIds?: string[]
    initialMountId?: string
    /** Held Talent ids - Flier 1 is required to ride a flying Mount ("You are able to ride a
     * flying mount..."). */
    talentIds?: string[]
    /** Skirmish Skill value - weapons "gain additional [CD] to their damage rating equal to
     * the Skirmish Skill of the character" (Chapter Seven), so the damage shown here matches
     * what the Character Sheet's Equipment card will show once equipped. */
    skirmishSkill?: number
  }>(),
  {
    initialEquippedWeaponIds: () => [],
    initialInventoryItemIds: () => [],
    talentIds: () => [],
    skirmishSkill: 0,
  },
)

const emit = defineEmits<{
  change: [
    payload: {
      equippedWeaponIds: string[]
      equippedArmorId?: string
      inventoryItemIds: string[]
      mountId?: string
    },
  ]
}>()

function countOccurrences(ids: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1
  return counts
}

function isBulky(qualities: IQualityInstance[]): boolean {
  return qualities.some((q) => q.quality === EquipmentQuality.Bulky)
}

function itemCost(qualities: IQualityInstance[]): number {
  return isBulky(qualities) ? 2 : 1
}

const weaponCounts = ref<Record<string, number>>(countOccurrences(props.initialEquippedWeaponIds))
const inventoryCounts = ref<Record<string, number>>(countOccurrences(props.initialInventoryItemIds))
const selectedArmorId = ref<string | null>(props.initialEquippedArmorId ?? null)
const selectedMountId = ref<string | null>(props.initialMountId ?? null)

const WEAPON_TAG_ORDER = [WeaponTag.Sword, WeaponTag.Axe, WeaponTag.Spear, WeaponTag.Bow, WeaponTag.Gauntlet]

function weaponTagDefinition(tag: WeaponTag) {
  return CoreContent.equipment.weaponTags.find((t) => t.id === tag)
}

function weaponsForTag(tag: WeaponTag): IWeaponData[] {
  return CoreContent.equipment.weapons.filter((w) => w.tag === tag)
}

function weaponById(id: string): IWeaponData | undefined {
  return CoreContent.equipment.weapons.find((w) => w.id === id)
}

/**
 * Which weapon (if any) is currently selected for each Tag's dropdown, initialized from
 * whichever weapon of that Tag has a nonzero count. At most one weapon per Tag is
 * selectable through this UI - if a character somehow had two different weapons of the same
 * Tag equipped already, only the first encountered here is kept.
 */
function initialSelectedWeaponIds(): Record<WeaponTag, string | null> {
  const result = {} as Record<WeaponTag, string | null>
  for (const tag of WEAPON_TAG_ORDER) result[tag] = null
  for (const id of props.initialEquippedWeaponIds) {
    const weapon = weaponById(id)
    if (weapon && result[weapon.tag] === null) result[weapon.tag] = id
  }
  return result
}
const selectedWeaponIds = ref<Record<WeaponTag, string | null>>(initialSelectedWeaponIds())

function weaponSelectItems(tag: WeaponTag) {
  return [{ title: 'None', value: null }, ...weaponsForTag(tag).map((w) => ({ title: w.name, value: w.id }))]
}

function selectWeapon(tag: WeaponTag, newId: string | null) {
  const oldId = selectedWeaponIds.value[tag]
  const counts = { ...weaponCounts.value }
  if (oldId) counts[oldId] = 0
  if (newId) counts[newId] = 1
  weaponCounts.value = counts
  selectedWeaponIds.value = { ...selectedWeaponIds.value, [tag]: newId }
}

/** "weapons gain additional [CD] to their damage rating equal to the Skirmish Skill of the
 * character," per Chapter Seven - same calculation the Character Sheet's Equipment card shows. */
function weaponDamageDisplay(weapon: IWeaponData): string {
  return `${weapon.damageCD + props.skirmishSkill}[CD]`
}
function weaponDamageTooltip(weapon: IWeaponData): string {
  return `Base ${weapon.damageCD}[CD], Skirmish +${props.skirmishSkill}`
}

const armorItems = computed(() => [
  { title: 'None', value: null },
  ...CoreContent.equipment.armor.map((a) => ({ title: a.name, value: a.id })),
])
const canRideFlyingMounts = computed(() => props.talentIds.includes('flier_1'))

const mountItems = computed(() => [
  { title: 'None', value: null },
  ...CoreContent.equipment.mounts.map((m) => ({
    title: m.canFly && !canRideFlyingMounts.value ? `${m.name} (Requires Flier 1)` : m.name,
    value: m.id,
    disabled: m.canFly && !canRideFlyingMounts.value,
  })),
])

const allInventoryItems = [...CoreContent.equipment.shields, ...CoreContent.equipment.general]
const generalItemDescriptions = new Map(CoreContent.equipment.general.map((g) => [g.id, g.description]))

const slotsUsed = computed(() => {
  let slots = 0
  for (const w of CoreContent.equipment.weapons) {
    slots += (weaponCounts.value[w.id] ?? 0) * itemCost(w.qualities)
  }
  if (selectedArmorId.value) {
    const a = CoreContent.equipment.armor.find((x) => x.id === selectedArmorId.value)
    if (a) slots += itemCost(a.qualities)
  }
  for (const i of allInventoryItems) {
    slots += (inventoryCounts.value[i.id] ?? 0) * itemCost(i.qualities)
  }
  return slots
})

/**
 * Highest count an item could reach without pushing total slots past MAX_SLOTS. `otherSlotsUsed`
 * already excludes this item's own current contribution, so the remaining budget - divided by
 * this item's cost - IS the max count directly; it must not also add `currentCount` on top
 * (that double-counts the item's existing slots and let the total silently exceed MAX_SLOTS).
 */
function maxCountFor(currentCount: number, qualities: IQualityInstance[]): number {
  const cost = itemCost(qualities)
  const otherSlotsUsed = slotsUsed.value - currentCount * cost
  return Math.floor((MAX_SLOTS - otherSlotsUsed) / cost)
}

function setWeaponCount(id: string, value: number) {
  weaponCounts.value = { ...weaponCounts.value, [id]: value }
}
function setInventoryCount(id: string, value: number) {
  inventoryCounts.value = { ...inventoryCounts.value, [id]: value }
}

function qualityLabel(q: IQualityInstance): string {
  const label = q.quality
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
  return q.value !== undefined ? `${label} ${q.value}` : label
}
function qualityTooltip(q: IQualityInstance): string | undefined {
  return CoreContent.equipment.qualities.find((x) => x.id === q.quality)?.description
}

function countsToIds(counts: Record<string, number>): string[] {
  const ids: string[] = []
  for (const [id, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) ids.push(id)
  }
  return ids
}

watch(
  [weaponCounts, inventoryCounts, selectedArmorId, selectedMountId],
  () => {
    emit('change', {
      equippedWeaponIds: countsToIds(weaponCounts.value),
      equippedArmorId: selectedArmorId.value ?? undefined,
      inventoryItemIds: countsToIds(inventoryCounts.value),
      mountId: selectedMountId.value ?? undefined,
    })
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <div>
    <div class="text-body-2 mb-2">Inventory slots used: {{ slotsUsed }} / {{ MAX_SLOTS }} (Bulky items cost 2)</div>
    <v-alert v-if="slotsUsed > MAX_SLOTS" type="warning" variant="tonal" density="compact" class="mb-3">
      Over your {{ MAX_SLOTS }}-slot inventory limit by {{ slotsUsed - MAX_SLOTS }} - remove something before finishing.
    </v-alert>

    <div class="text-subtitle-2 mb-1">Weapons</div>
    <div v-for="tag in WEAPON_TAG_ORDER" :key="tag" class="d-flex align-center flex-wrap mb-2">
      <TooltipChip
        :label="weaponTagDefinition(tag)?.name ?? tag"
        :tooltip="weaponTagDefinition(tag)?.description"
        class="mr-2"
      />
      <v-select
        :model-value="selectedWeaponIds[tag]"
        :items="weaponSelectItems(tag)"
        density="compact"
        hide-details
        style="max-width: 220px"
        class="mr-2"
        @update:model-value="(id) => selectWeapon(tag, id)"
      />
      <template v-if="selectedWeaponIds[tag]">
        <QuantityStepper
          :model-value="weaponCounts[selectedWeaponIds[tag]!] ?? 1"
          :min="1"
          :max="maxCountFor(weaponCounts[selectedWeaponIds[tag]!] ?? 1, weaponById(selectedWeaponIds[tag]!)!.qualities)"
          @update:model-value="(v) => setWeaponCount(selectedWeaponIds[tag]!, v)"
        />
        <span class="mx-2">
          Damage:
          <DerivedValueBadge
            :display="weaponDamageDisplay(weaponById(selectedWeaponIds[tag]!)!)"
            :tooltip="weaponDamageTooltip(weaponById(selectedWeaponIds[tag]!)!)"
          />
        </span>
        <TooltipChip
          v-for="(q, i) in weaponById(selectedWeaponIds[tag]!)!.qualities"
          :key="i"
          :label="qualityLabel(q)"
          :tooltip="qualityTooltip(q)"
        />
      </template>
    </div>

    <div class="text-subtitle-2 mt-3 mb-1">Armor</div>
    <v-select v-model="selectedArmorId" :items="armorItems" density="compact" label="Armor" />

    <div class="text-subtitle-2 mb-1">Inventory (Shields &amp; General)</div>
    <div v-for="i in allInventoryItems" :key="i.id" class="d-flex align-center mb-1">
      <QuantityStepper
        :model-value="inventoryCounts[i.id] ?? 0"
        :max="maxCountFor(inventoryCounts[i.id] ?? 0, i.qualities)"
        @update:model-value="(v) => setInventoryCount(i.id, v)"
      />
      <v-tooltip v-if="generalItemDescriptions.get(i.id)" :text="generalItemDescriptions.get(i.id)" location="top" max-width="320">
        <template #activator="{ props: activatorProps }">
          <span v-bind="activatorProps" class="mx-2 item-name-hoverable">{{ i.name }}</span>
        </template>
      </v-tooltip>
      <span v-else class="mx-2">{{ i.name }}</span>
      <TooltipChip v-for="(q, qi) in i.qualities" :key="qi" :label="qualityLabel(q)" :tooltip="qualityTooltip(q)" />
    </div>

    <div class="text-subtitle-2 mt-3 mb-1">Mount (optional, no slot cost)</div>
    <v-select v-model="selectedMountId" :items="mountItems" item-props density="compact" label="Mount" />
  </div>
</template>

<style scoped>
.item-name-hoverable {
  cursor: help;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
</style>
