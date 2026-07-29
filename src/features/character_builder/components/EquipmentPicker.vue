<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { EquipmentQuality } from '@/classes/Equipment'

const MAX_SLOTS = 5

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

function isBulky(qualities: { quality: EquipmentQuality }[]): boolean {
  return qualities.some((q) => q.quality === EquipmentQuality.Bulky)
}

const selectedWeaponIds = ref<string[]>([])
const selectedArmorId = ref<string | null>(null)
const selectedShieldIds = ref<string[]>([])
const selectedGeneralIds = ref<string[]>([])
const selectedMountId = ref<string | null>(null)

const armorItems = computed(() => [
  { title: 'None', value: null },
  ...CoreContent.equipment.armor.map((a) => ({ title: a.name, value: a.id })),
])
const mountItems = computed(() => [
  { title: 'None', value: null },
  ...CoreContent.equipment.mounts.map((m) => ({ title: m.name, value: m.id })),
])

const slotsUsed = computed(() => {
  let slots = 0
  for (const id of selectedWeaponIds.value) {
    const w = CoreContent.equipment.weapons.find((x) => x.id === id)
    if (w) slots += isBulky(w.qualities) ? 2 : 1
  }
  if (selectedArmorId.value) {
    const a = CoreContent.equipment.armor.find((x) => x.id === selectedArmorId.value)
    if (a) slots += isBulky(a.qualities) ? 2 : 1
  }
  for (const id of selectedShieldIds.value) {
    const s = CoreContent.equipment.shields.find((x) => x.id === id)
    if (s) slots += isBulky(s.qualities) ? 2 : 1
  }
  for (const id of selectedGeneralIds.value) {
    const g = CoreContent.equipment.general.find((x) => x.id === id)
    if (g) slots += isBulky(g.qualities) ? 2 : 1
  }
  return slots
})

function itemCost(qualities: { quality: EquipmentQuality }[]): number {
  return isBulky(qualities) ? 2 : 1
}

function wouldExceed(cost: number): boolean {
  return slotsUsed.value + cost > MAX_SLOTS
}

watch([selectedWeaponIds, selectedArmorId, selectedShieldIds, selectedGeneralIds, selectedMountId], () => {
  emit('change', {
    equippedWeaponIds: selectedWeaponIds.value,
    equippedArmorId: selectedArmorId.value ?? undefined,
    inventoryItemIds: [...selectedShieldIds.value, ...selectedGeneralIds.value],
    mountId: selectedMountId.value ?? undefined,
  })
}, { deep: true })
</script>

<template>
  <div>
    <div class="text-body-2 mb-2">Inventory slots used: {{ slotsUsed }} / {{ MAX_SLOTS }} (Bulky items cost 2)</div>

    <div class="text-subtitle-2 mb-1">Weapons</div>
    <v-checkbox
      v-for="w in CoreContent.equipment.weapons"
      :key="w.id"
      v-model="selectedWeaponIds"
      :value="w.id"
      :label="`${w.name} (${w.damageCD}[CD]${itemCost(w.qualities) === 2 ? ', Bulky' : ''})`"
      density="compact"
      :disabled="!selectedWeaponIds.includes(w.id) && wouldExceed(itemCost(w.qualities))"
      hide-details
    />

    <div class="text-subtitle-2 mt-3 mb-1">Armor</div>
    <v-select v-model="selectedArmorId" :items="armorItems" density="compact" label="Armor" />

    <div class="text-subtitle-2 mb-1">Shields</div>
    <v-checkbox
      v-for="s in CoreContent.equipment.shields"
      :key="s.id"
      v-model="selectedShieldIds"
      :value="s.id"
      :label="s.name"
      density="compact"
      :disabled="!selectedShieldIds.includes(s.id) && wouldExceed(itemCost(s.qualities))"
      hide-details
    />

    <div class="text-subtitle-2 mt-3 mb-1">General Equipment</div>
    <v-checkbox
      v-for="g in CoreContent.equipment.general"
      :key="g.id"
      v-model="selectedGeneralIds"
      :value="g.id"
      :label="g.name"
      density="compact"
      :disabled="!selectedGeneralIds.includes(g.id) && wouldExceed(itemCost(g.qualities))"
      hide-details
    />

    <div class="text-subtitle-2 mt-3 mb-1">Mount (optional, no slot cost)</div>
    <v-select v-model="selectedMountId" :items="mountItems" density="compact" label="Mount" />
  </div>
</template>
