<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { EquipmentQuality } from '@/classes/Equipment'
import type { IQualityInstance } from '@/classes/Equipment'
import TooltipChip from '@/ui/TooltipChip.vue'
import QuantityStepper from '@/ui/QuantityStepper.vue'

const MAX_SLOTS = 5

/**
 * Equipping the same item more than once is meaningful in Ascension (dual-wielding two
 * identical weapons, carrying multiple Tomes for extra Spell Slots, etc.), so weapons and
 * inventory items (shields + general) are tracked as per-item counts rather than a picked/
 * not-picked set. Armor and Mount stay single-select - only one of each can be worn/ridden.
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
  }>(),
  {
    initialEquippedWeaponIds: () => [],
    initialInventoryItemIds: () => [],
    talentIds: () => [],
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
    <div v-for="w in CoreContent.equipment.weapons" :key="w.id" class="d-flex align-center mb-1">
      <QuantityStepper
        :model-value="weaponCounts[w.id] ?? 0"
        :max="maxCountFor(weaponCounts[w.id] ?? 0, w.qualities)"
        @update:model-value="(v) => setWeaponCount(w.id, v)"
      />
      <span class="mx-2">{{ w.name }} ({{ w.damageCD }}[CD]{{ itemCost(w.qualities) === 2 ? ', Bulky' : '' }})</span>
      <TooltipChip v-for="(q, i) in w.qualities" :key="i" :label="qualityLabel(q)" :tooltip="qualityTooltip(q)" />
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
      <span class="mx-2">{{ i.name }}</span>
      <TooltipChip v-for="(q, qi) in i.qualities" :key="qi" :label="qualityLabel(q)" :tooltip="qualityTooltip(q)" />
    </div>

    <div class="text-subtitle-2 mt-3 mb-1">Mount (optional, no slot cost)</div>
    <v-select v-model="selectedMountId" :items="mountItems" item-props density="compact" label="Mount" />
  </div>
</template>
