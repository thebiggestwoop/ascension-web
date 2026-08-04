<script setup lang="ts">
import { computed } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import type { IArchetypeCharacterData } from '@/classes/Archetype'
import type { IQualityInstance } from '@/classes/Equipment'
import { equipmentSlotCost, MAX_INVENTORY_SLOTS } from '@/classes/Equipment'
import { TalentCategory } from '@/classes/enums'
import MarkdownText from '@/ui/MarkdownText.vue'
import TooltipChip from '@/ui/TooltipChip.vue'

/**
 * Start from an Archetype, Step One: a read-only look at exactly what this pregen comes
 * with - Attributes/Skills, Talents (with their rules text), Equipment/Mount, and Spells -
 * before touching anything. No "(was X)" comparison text like CharacterPreview.vue, since
 * there's nothing pending yet to compare against; no editing controls at all.
 */
const props = defineProps<{ archetype: IArchetypeCharacterData; playstyle: string }>()
const emit = defineEmits<{ continue: [] }>()

const allTalents = [...CoreContent.talents.narrative, ...CoreContent.talents.combat]
const heldTalents = computed(() => allTalents.filter((t) => props.archetype.talentIds.includes(t.id)))
const narrativeTalents = computed(() => heldTalents.value.filter((t) => t.category === TalentCategory.Narrative))
const combatTalents = computed(() => heldTalents.value.filter((t) => t.category === TalentCategory.Combat))

const equippedWeaponGroups = computed(() => {
  const counts: Record<string, number> = {}
  for (const id of props.archetype.equippedWeaponIds) counts[id] = (counts[id] ?? 0) + 1
  return Object.entries(counts)
    .map(([id, count]) => ({ weapon: CoreContent.equipment.weapons.find((w) => w.id === id), count }))
    .filter((g): g is { weapon: NonNullable<typeof g.weapon>; count: number } => !!g.weapon)
})
const equippedArmor = computed(() =>
  props.archetype.equippedArmorId
    ? CoreContent.equipment.armor.find((a) => a.id === props.archetype.equippedArmorId)
    : undefined,
)
const allInventoryItems = [...CoreContent.equipment.shields, ...CoreContent.equipment.general]
const generalItemDescriptions = new Map(CoreContent.equipment.general.map((g) => [g.id, g.description]))
const inventoryGroups = computed(() => {
  const counts: Record<string, number> = {}
  for (const id of props.archetype.inventoryItemIds) counts[id] = (counts[id] ?? 0) + 1
  return Object.entries(counts)
    .map(([id, count]) => ({ item: allInventoryItems.find((i) => i.id === id), count }))
    .filter((g): g is { item: NonNullable<typeof g.item>; count: number } => !!g.item)
})
const mount = computed(() =>
  props.archetype.mountId ? CoreContent.equipment.mounts.find((m) => m.id === props.archetype.mountId) : undefined,
)
const usedInventorySlots = computed(() => {
  let slots = 0
  for (const g of equippedWeaponGroups.value) slots += g.count * equipmentSlotCost(g.weapon.qualities)
  if (equippedArmor.value) slots += equipmentSlotCost(equippedArmor.value.qualities)
  for (const g of inventoryGroups.value) slots += g.count * equipmentSlotCost(g.item.qualities)
  return slots
})

const allSpells = [...CoreContent.spells.arcane, ...CoreContent.spells.light, ...CoreContent.spells.dark]
const preparedSpells = computed(() => allSpells.filter((s) => props.archetype.preparedSpellIds.includes(s.id)))

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
</script>

<template>
  <div>
    <h3 class="text-h6 mb-1">{{ archetype.name }}</h3>
    <div class="text-subtitle-2 mb-1">Playstyle</div>
    <p class="text-body-2 text-medium-emphasis mb-4">{{ playstyle }}</p>

    <v-row class="mb-2">
      <v-col cols="12" sm="6">
        <div class="text-subtitle-2 mb-1">Attributes</div>
        <v-row dense>
          <v-col v-for="attr in CoreContent.attributes" :key="attr.id" cols="6">
            {{ attr.name }}: <strong>{{ archetype.attributes[attr.id] }}</strong>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" sm="6">
        <div class="text-subtitle-2 mb-1">Skills</div>
        <v-row dense>
          <v-col v-for="skill in CoreContent.skills" :key="skill.id" cols="6">
            {{ skill.name }}: <strong>{{ archetype.skills[skill.id] }}</strong>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <v-card class="mb-4" variant="outlined">
      <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
        <span>Equipment</span>
        <span class="text-body-2 text-medium-emphasis">
          Inventory Slots: {{ usedInventorySlots }} / {{ MAX_INVENTORY_SLOTS }}
        </span>
      </v-card-title>
      <v-card-text>
        <div class="text-subtitle-2 mb-1">Weapons</div>
        <div v-if="!equippedWeaponGroups.length" class="text-medium-emphasis mb-2">None</div>
        <div v-for="g in equippedWeaponGroups" :key="g.weapon.id" class="d-flex align-center flex-wrap mb-2" style="gap: 4px">
          <span class="mr-1">{{ g.weapon.name }}<span v-if="g.count > 1"> x{{ g.count }}</span></span>
          <TooltipChip
            v-for="(q, i) in g.weapon.qualities"
            :key="i"
            :label="qualityLabel(q)"
            :tooltip="qualityTooltip(q)"
          />
        </div>

        <div class="text-subtitle-2 mb-1">Armor</div>
        <div class="text-medium-emphasis mb-2">
          <template v-if="equippedArmor">
            <span class="mr-2">{{ equippedArmor.name }} (Resistance {{ equippedArmor.resistance }})</span>
            <TooltipChip
              v-for="(q, i) in equippedArmor.qualities"
              :key="i"
              :label="qualityLabel(q)"
              :tooltip="qualityTooltip(q)"
            />
          </template>
          <span v-else>None</span>
        </div>

        <div class="text-subtitle-2 mb-1">Inventory</div>
        <div v-if="!inventoryGroups.length" class="text-medium-emphasis mb-2">Empty</div>
        <div v-for="g in inventoryGroups" :key="g.item.id" class="mb-2">
          <v-tooltip
            v-if="generalItemDescriptions.get(g.item.id)"
            :text="generalItemDescriptions.get(g.item.id)"
            location="top"
            max-width="320"
          >
            <template #activator="{ props: activatorProps }">
              <span v-bind="activatorProps" class="mr-2 item-name-hoverable">
                {{ g.item.name }}<span v-if="g.count > 1"> x{{ g.count }}</span>
              </span>
            </template>
          </v-tooltip>
          <span v-else class="mr-2">{{ g.item.name }}<span v-if="g.count > 1"> x{{ g.count }}</span></span>
          <TooltipChip v-for="(q, qi) in g.item.qualities" :key="qi" :label="qualityLabel(q)" :tooltip="qualityTooltip(q)" />
        </div>

        <template v-if="mount">
          <div class="text-subtitle-2 mb-1">Mount</div>
          <v-card variant="tonal">
            <v-card-title class="text-subtitle-1">{{ mount.name }}</v-card-title>
            <v-card-text>
              <div class="mb-1">
                <TooltipChip v-if="mount.canFly" label="Flies" />
                <TooltipChip v-if="mount.groundImmobile" label="Ground Immobile" />
              </div>
              <p v-if="mount.specialRules" class="text-body-2 text-medium-emphasis mb-0">{{ mount.specialRules }}</p>
            </v-card-text>
          </v-card>
        </template>
      </v-card-text>
    </v-card>

    <v-card class="mb-4" variant="outlined">
      <v-card-title>Talents</v-card-title>
      <v-card-text>
        <div class="text-subtitle-2 mb-1">Narrative</div>
        <v-card v-for="t in narrativeTalents" :key="t.id" variant="tonal" class="mb-2">
          <v-card-title class="text-subtitle-1">{{ t.name }}</v-card-title>
          <v-card-subtitle>{{ t.group }}</v-card-subtitle>
          <v-card-text><MarkdownText :source="t.effectText" /></v-card-text>
        </v-card>
        <span v-if="!narrativeTalents.length" class="text-medium-emphasis">None</span>

        <div class="text-subtitle-2 mt-3 mb-1">Combat</div>
        <v-card v-for="t in combatTalents" :key="t.id" variant="tonal" class="mb-2">
          <v-card-title class="text-subtitle-1">{{ t.name }}</v-card-title>
          <v-card-subtitle>{{ t.group }}<span v-if="t.tier"> - Tier {{ t.tier }}</span></v-card-subtitle>
          <v-card-text><MarkdownText :source="t.effectText" /></v-card-text>
        </v-card>
        <span v-if="!combatTalents.length" class="text-medium-emphasis">None</span>
      </v-card-text>
    </v-card>

    <v-card v-if="preparedSpells.length" class="mb-4" variant="outlined">
      <v-card-title>Spells</v-card-title>
      <v-card-text>
        <v-card v-for="s in preparedSpells" :key="s.id" variant="tonal" class="mb-2">
          <v-card-title class="text-subtitle-1">{{ s.name }}</v-card-title>
          <v-card-subtitle>Tier {{ s.tier }} - {{ s.slotCost }} Spell Slot{{ s.slotCost > 1 ? 's' : '' }}</v-card-subtitle>
          <v-card-text v-if="s.effectText"><MarkdownText :source="s.effectText" /></v-card-text>
        </v-card>
      </v-card-text>
    </v-card>

    <v-btn color="primary" @click="emit('continue')">Continue</v-btn>
  </div>
</template>

<style scoped>
.item-name-hoverable {
  cursor: help;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
</style>
