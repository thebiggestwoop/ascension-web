<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import type { AttributeId } from '@/classes/enums'
import { WeaponTag, MAX_INVENTORY_SLOTS, equipmentSlotCost } from '@/classes/Equipment'
import type { IQualityInstance, IWeaponData } from '@/classes/Equipment'
import type { IMountData } from '@/classes/Mount'
import { mountedSpeed } from '@/classes/Mount'
import TooltipChip from '@/ui/TooltipChip.vue'
import QuantityStepper from '@/ui/QuantityStepper.vue'
import DerivedValueBadge from '@/ui/DerivedValueBadge.vue'

/**
 * Equipping the same item more than once is meaningful in Ascension (dual-wielding two
 * identical weapons, carrying multiple Tomes for extra Spell Slots, etc.), so weapons and
 * inventory items (shields + general) are tracked as per-item counts rather than a picked/
 * not-picked set. Armor and Mount stay single-select - only one of each can be worn/ridden.
 * Weapons are grouped into collapsible sections by Weapon Tag (Sword/Axe/Spear/Bow/Gauntlet)
 * so the full ~26-weapon list isn't all on screen at once, but every individual weapon
 * underneath is still equippable (and stackable) independently, same as before grouping.
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
    /** Current Attributes - a Mount's Speed is baseSpeed + floor(its Riding Attribute / 2), so
     * the value shown here matches what the Character Sheet will show once equipped. */
    attributes?: Record<AttributeId, number>
  }>(),
  {
    initialEquippedWeaponIds: () => [],
    initialInventoryItemIds: () => [],
    talentIds: () => [],
    skirmishSkill: 0,
    attributes: () => ({}) as Record<AttributeId, number>,
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

const weaponCounts = ref<Record<string, number>>(countOccurrences(props.initialEquippedWeaponIds))
const inventoryCounts = ref<Record<string, number>>(countOccurrences(props.initialInventoryItemIds))
const selectedArmorId = ref<string | null>(props.initialEquippedArmorId ?? null)
const selectedMountId = ref<string | null>(props.initialMountId ?? null)

/** The rules' own weapon grouping (Chapter Seven), used here purely to organize the full
 * weapon list into collapsible sections - every weapon is still equippable independently,
 * with its own count, same as before this grouping was added. */
const WEAPON_TAG_ORDER = [WeaponTag.Sword, WeaponTag.Axe, WeaponTag.Spear, WeaponTag.Bow, WeaponTag.Gauntlet]

function weaponTagDefinition(tag: WeaponTag) {
  return CoreContent.equipment.weaponTags.find((t) => t.id === tag)
}

function weaponsForTag(tag: WeaponTag): IWeaponData[] {
  return CoreContent.equipment.weapons.filter((w) => w.tag === tag)
}

/** Shown on each Tag's (collapsed) header so it's clear what's equipped without expanding it. */
function tagEquippedCount(tag: WeaponTag): number {
  return weaponsForTag(tag).reduce((sum, w) => sum + (weaponCounts.value[w.id] ?? 0), 0)
}

/** "weapons gain additional [CD] to their damage rating equal to the Skirmish Skill of the
 * character," per Chapter Seven - same calculation the Character Sheet's Equipment card shows. */
function weaponDamageDisplay(weapon: IWeaponData): string {
  return `${weapon.damageCD + props.skirmishSkill}[CD]`
}
function weaponDamageTooltip(weapon: IWeaponData): string {
  return `Base ${weapon.damageCD}[CD], Skirmish +${props.skirmishSkill}`
}

const canRideFlyingMounts = computed(() => props.talentIds.includes('flier_1'))

function ridingAttributeName(id: AttributeId): string {
  return CoreContent.attributes.find((a) => a.id === id)?.name ?? id
}
/** "A [Mount] has a Speed equal to [baseSpeed] + half your Riding (rounded down)" - live so it
 * matches what the Character Sheet will show once this Mount is equipped. */
function mountSpeedDisplay(mount: IMountData): string {
  const attrValue = props.attributes[mount.ridingAttribute] ?? 0
  return `${mountedSpeed(mount, attrValue)}`
}
function mountSpeedTooltip(mount: IMountData): string {
  const attrValue = props.attributes[mount.ridingAttribute] ?? 0
  return `${mount.baseSpeed} + floor(${ridingAttributeName(mount.ridingAttribute)} ${attrValue} / 2) - replaces your own Speed while mounted`
}

const allInventoryItems = [...CoreContent.equipment.shields, ...CoreContent.equipment.general]
const generalItemDescriptions = new Map(CoreContent.equipment.general.map((g) => [g.id, g.description]))

const slotsUsed = computed(() => {
  let slots = 0
  for (const w of CoreContent.equipment.weapons) {
    slots += (weaponCounts.value[w.id] ?? 0) * equipmentSlotCost(w.qualities)
  }
  if (selectedArmorId.value) {
    const a = CoreContent.equipment.armor.find((x) => x.id === selectedArmorId.value)
    if (a) slots += equipmentSlotCost(a.qualities)
  }
  for (const i of allInventoryItems) {
    slots += (inventoryCounts.value[i.id] ?? 0) * equipmentSlotCost(i.qualities)
  }
  return slots
})

/**
 * Highest count an item could reach without pushing total slots past MAX_INVENTORY_SLOTS.
 * `otherSlotsUsed` already excludes this item's own current contribution, so the remaining
 * budget - divided by this item's cost - IS the max count directly; it must not also add
 * `currentCount` on top (that double-counts the item's existing slots and lets the total
 * silently exceed MAX_INVENTORY_SLOTS).
 */
function maxCountFor(currentCount: number, qualities: IQualityInstance[]): number {
  const cost = equipmentSlotCost(qualities)
  const otherSlotsUsed = slotsUsed.value - currentCount * cost
  return Math.floor((MAX_INVENTORY_SLOTS - otherSlotsUsed) / cost)
}

function setWeaponCount(id: string, value: number) {
  weaponCounts.value = { ...weaponCounts.value, [id]: value }
}
function setInventoryCount(id: string, value: number) {
  inventoryCounts.value = { ...inventoryCounts.value, [id]: value }
}

/** Weapons always have this; general items/shields only when they actually need a hand free
 * to wield (e.g. Banner, Spell Implement - a Healing Potion or Tome don't). */
function handsChip(hands: number | undefined): { label: string; tooltip: string } | null {
  if (hands === 1) return { label: '1H', tooltip: 'One-Handed' }
  if (hands === 2) return { label: '2H', tooltip: 'Two-Handed' }
  return null
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
    <div class="text-body-2 mb-2">Inventory slots used: {{ slotsUsed }} / {{ MAX_INVENTORY_SLOTS }} (Bulky items cost 2)</div>
    <v-alert v-if="slotsUsed > MAX_INVENTORY_SLOTS" type="warning" variant="tonal" density="compact" class="mb-3">
      Over your {{ MAX_INVENTORY_SLOTS }}-slot inventory limit by {{ slotsUsed - MAX_INVENTORY_SLOTS }} - remove something before finishing.
    </v-alert>

    <div class="text-subtitle-2 mb-1">Weapons</div>
    <v-expansion-panels variant="accordion" multiple class="mb-2">
      <v-expansion-panel v-for="tag in WEAPON_TAG_ORDER" :key="tag">
        <v-expansion-panel-title>
          <TooltipChip
            :label="weaponTagDefinition(tag)?.name ?? tag"
            :tooltip="weaponTagDefinition(tag)?.description"
            class="mr-2"
          />
          <span v-if="tagEquippedCount(tag) > 0" class="text-caption text-medium-emphasis">
            {{ tagEquippedCount(tag) }} equipped
          </span>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div v-for="w in weaponsForTag(tag)" :key="w.id" class="d-flex align-center flex-wrap mb-1">
            <QuantityStepper
              :model-value="weaponCounts[w.id] ?? 0"
              :max="maxCountFor(weaponCounts[w.id] ?? 0, w.qualities)"
              @update:model-value="(v) => setWeaponCount(w.id, v)"
            />
            <span class="mx-2">{{ w.name }}</span>
            <TooltipChip
              v-if="handsChip(w.hands)"
              :label="handsChip(w.hands)!.label"
              :tooltip="handsChip(w.hands)!.tooltip"
            />
            <span class="mx-2">
              Damage:
              <DerivedValueBadge :display="weaponDamageDisplay(w)" :tooltip="weaponDamageTooltip(w)" />
            </span>
            <span v-if="w.range" class="mx-2 text-body-2">Range: <strong>{{ w.range }}</strong></span>
            <TooltipChip v-for="(q, i) in w.qualities" :key="i" :label="qualityLabel(q)" :tooltip="qualityTooltip(q)" />
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <div class="text-subtitle-2 mt-3 mb-1">Armor</div>
    <v-radio-group v-model="selectedArmorId" hide-details>
      <div v-for="a in CoreContent.equipment.armor" :key="a.id" class="d-flex align-center flex-wrap mb-1" style="gap: 8px">
        <v-radio :value="a.id" :label="a.name" />
        <span class="text-body-2">Resistance: <strong>{{ a.resistance }}</strong></span>
        <TooltipChip v-for="(q, i) in a.qualities" :key="i" :label="qualityLabel(q)" :tooltip="qualityTooltip(q)" />
      </div>
      <v-radio :value="null" label="None" />
    </v-radio-group>

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
      <TooltipChip v-if="handsChip(i.hands)" :label="handsChip(i.hands)!.label" :tooltip="handsChip(i.hands)!.tooltip" />
      <TooltipChip v-for="(q, qi) in i.qualities" :key="qi" :label="qualityLabel(q)" :tooltip="qualityTooltip(q)" />
    </div>

    <div class="text-subtitle-2 mt-3 mb-1">Mount (optional, no slot cost)</div>
    <v-radio-group v-model="selectedMountId" hide-details>
      <div
        v-for="m in CoreContent.equipment.mounts"
        :key="m.id"
        class="d-flex align-center flex-wrap mb-1"
        style="gap: 8px"
      >
        <v-radio :value="m.id" :label="m.name" :disabled="m.canFly && !canRideFlyingMounts" />
        <span class="text-body-2">Riding: <strong>{{ ridingAttributeName(m.ridingAttribute) }}</strong></span>
        <span class="text-body-2">
          Speed:
          <DerivedValueBadge :display="mountSpeedDisplay(m)" :tooltip="mountSpeedTooltip(m)" />
        </span>
        <TooltipChip v-if="m.canFly" label="Flies" />
        <TooltipChip
          v-if="m.canFly && !canRideFlyingMounts"
          label="Requires Flier 1"
          tooltip="You must have the Flier 1 Talent to ride a flying Mount."
        />
        <TooltipChip v-if="m.specialRules" label="Special Rules" :tooltip="m.specialRules" />
      </div>
      <v-radio :value="null" label="None" />
    </v-radio-group>
  </div>
</template>

<style scoped>
.item-name-hoverable {
  cursor: help;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
</style>
