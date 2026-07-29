<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'

/**
 * Restricted to the two fully-transcribed Talent groups (Warrior, Sword Adept) - the
 * other 62 groups are name/prerequisite-only in content/talents/_index.json and can't be
 * meaningfully picked from yet. See _index.json for what's still pending transcription.
 */
const props = defineProps<{ currentAgility: number }>()
const emit = defineEmits<{ change: [payload: { narrativeTalentIds: string[]; combatTalentIds: string[] }] }>()

const NARRATIVE_PICK_COUNT = 3

const warriorAbilities = CoreContent.talents.narrative.filter((t) => t.group === 'Warrior')
const swordAdeptTier1 = CoreContent.talents.combat.find((t) => t.group === 'Sword Adept' && t.tier === 1)

const selectedNarrativeIds = ref<string[]>([])
const selectedCombatIds = ref<string[]>([])

const meetsSwordAdeptPrereq = computed(() => props.currentAgility >= 10)

watch([selectedNarrativeIds, selectedCombatIds], () => {
  emit('change', {
    narrativeTalentIds: selectedNarrativeIds.value,
    combatTalentIds: selectedCombatIds.value,
  })
}, { deep: true })
</script>

<template>
  <div>
    <div class="text-subtitle-2 mb-1">
      Narrative Talents - Warrior (pick exactly {{ NARRATIVE_PICK_COUNT }} of {{ warriorAbilities.length }})
    </div>
    <v-checkbox
      v-for="t in warriorAbilities"
      :key="t.id"
      v-model="selectedNarrativeIds"
      :value="t.id"
      :label="t.name"
      :hint="t.effectText"
      persistent-hint
      density="compact"
      :disabled="!selectedNarrativeIds.includes(t.id) && selectedNarrativeIds.length >= NARRATIVE_PICK_COUNT"
    />

    <div class="text-subtitle-2 mt-3 mb-1">Combat Talents - Sword Adept (Tier 1)</div>
    <p class="text-caption text-medium-emphasis mb-2">
      Only 1 of the 4 required Tier-1 Combat Talents is available right now - the
      remaining 48 Combat Talent Trees aren't transcribed yet.
    </p>
    <v-checkbox
      v-if="swordAdeptTier1"
      v-model="selectedCombatIds"
      :value="swordAdeptTier1.id"
      :label="swordAdeptTier1.name"
      :hint="meetsSwordAdeptPrereq ? swordAdeptTier1.effectText : `Requires Agility 10 (currently ${currentAgility})`"
      persistent-hint
      density="compact"
      :disabled="!meetsSwordAdeptPrereq"
    />
  </div>
</template>
