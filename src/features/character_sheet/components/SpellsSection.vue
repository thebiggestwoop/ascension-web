<script setup lang="ts">
import { computed } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { resolveMagickDomainAccess } from '@/classes/Spell'
import type { ISpellData, MagickDomain } from '@/classes/Spell'
import QuantityStepper from '@/ui/QuantityStepper.vue'

const props = defineProps<{ talentIds: string[]; preparedSpellIds: string[]; spellSlots: number }>()
const emit = defineEmits<{ change: [ids: string[]] }>()

const domainAccess = computed(() => resolveMagickDomainAccess(props.talentIds))

const domainSpells: Record<MagickDomain, ISpellData[]> = {
  arcane: CoreContent.spells.arcane,
  light: CoreContent.spells.light,
  dark: CoreContent.spells.dark,
}
const allSpells = [...CoreContent.spells.arcane, ...CoreContent.spells.light, ...CoreContent.spells.dark]

const preparedCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const id of props.preparedSpellIds) counts[id] = (counts[id] ?? 0) + 1
  return counts
})

const slotsUsed = computed(() => {
  let used = 0
  for (const [id, count] of Object.entries(preparedCounts.value)) {
    const spell = allSpells.find((s) => s.id === id)
    if (spell) used += spell.slotCost * count
  }
  return used
})

/** Highest count `spell` could reach without pushing total prepared slots past the character's Spell Slots. */
function maxCountFor(spell: ISpellData): number {
  const current = preparedCounts.value[spell.id] ?? 0
  const otherSlotsUsed = slotsUsed.value - current * spell.slotCost
  return current + Math.floor((props.spellSlots - otherSlotsUsed) / spell.slotCost)
}

function setCount(id: string, value: number) {
  const counts = { ...preparedCounts.value, [id]: value }
  const ids: string[] = []
  for (const [spellId, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) ids.push(spellId)
  }
  emit('change', ids)
}
</script>

<template>
  <div v-if="domainAccess.length">
    <div class="text-body-2 mb-2">Spell Slots used: {{ slotsUsed }} / {{ spellSlots }}</div>
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
