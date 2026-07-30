<script setup lang="ts">
import { ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { resolveMagickDomainAccess } from '@/classes/Spell'
import type { ISpellData, MagickDomain } from '@/classes/Spell'
import QuantityStepper from '@/ui/QuantityStepper.vue'

const props = defineProps<{
  talentIds: string[]
  initialPreparedSpellIds: string[]
  spellSlots: number
}>()
const emit = defineEmits<{ change: [ids: string[]] }>()

const domainAccess = resolveMagickDomainAccess(props.talentIds)

const domainSpells: Record<MagickDomain, ISpellData[]> = {
  arcane: CoreContent.spells.arcane,
  light: CoreContent.spells.light,
  dark: CoreContent.spells.dark,
}
const allSpells = [...CoreContent.spells.arcane, ...CoreContent.spells.light, ...CoreContent.spells.dark]

function countOccurrences(ids: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1
  return counts
}

const preparedCounts = ref<Record<string, number>>(countOccurrences(props.initialPreparedSpellIds))

function slotsUsedExcept(excludeId?: string): number {
  let used = 0
  for (const [id, count] of Object.entries(preparedCounts.value)) {
    if (id === excludeId) continue
    const spell = allSpells.find((s) => s.id === id)
    if (spell) used += spell.slotCost * count
  }
  return used
}

const totalSlotsUsed = () => slotsUsedExcept(undefined)

/**
 * Highest count `spell` could reach without pushing total prepared slots past the character's
 * Spell Slots. `otherSlotsUsed` already excludes this spell's own current contribution, so the
 * remaining budget divided by its slot cost IS the max directly - adding `current` on top would
 * double-count this spell's existing slots and let the total silently exceed Spell Slots.
 */
function maxCountFor(spell: ISpellData): number {
  const otherSlotsUsed = slotsUsedExcept(spell.id)
  return Math.floor((props.spellSlots - otherSlotsUsed) / spell.slotCost)
}

function setCount(id: string, value: number) {
  preparedCounts.value = { ...preparedCounts.value, [id]: value }
}

watch(
  preparedCounts,
  () => {
    const ids: string[] = []
    for (const [spellId, count] of Object.entries(preparedCounts.value)) {
      for (let i = 0; i < count; i++) ids.push(spellId)
    }
    emit('change', ids)
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <div v-if="domainAccess.length">
    <div class="text-body-2 mb-2">Spell Slots used: {{ totalSlotsUsed() }} / {{ spellSlots }}</div>
    <v-alert v-if="totalSlotsUsed() > spellSlots" type="warning" variant="tonal" density="compact" class="mb-3">
      Over your {{ spellSlots }} Spell Slots by {{ totalSlotsUsed() - spellSlots }} - unprepare something before finishing.
    </v-alert>
    <div v-for="access in domainAccess" :key="access.domain">
      <div class="text-subtitle-2 text-capitalize mt-2 mb-1">{{ access.domain }} (up to Tier {{ access.maxTier }})</div>
      <div
        v-for="spell in domainSpells[access.domain].filter((s) => s.tier <= access.maxTier)"
        :key="spell.id"
        class="d-flex align-center mb-1"
      >
        <QuantityStepper
          :model-value="preparedCounts[spell.id] ?? 0"
          :max="maxCountFor(spell)"
          @update:model-value="(v) => setCount(spell.id, v)"
        />
        <span class="mx-2">{{ spell.name }} (Tier {{ spell.tier }}, {{ spell.slotCost }} slot{{ spell.slotCost > 1 ? 's' : '' }})</span>
      </div>
    </div>
  </div>
  <p v-else class="text-medium-emphasis">No Magick Domain Talent held - this character is not a Spellcaster.</p>
</template>
