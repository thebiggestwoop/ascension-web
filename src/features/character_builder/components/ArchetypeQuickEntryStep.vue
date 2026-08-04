<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { useCharacterDraftStore } from '../store/CharacterDraftStore'

/**
 * Start from an Archetype, Step Two's "Quick Entry" option: the same flat Focus/Value/Trait
 * form Quick Build itself uses, rather than stepping through Lifepath's five stages. Counts
 * (6 Focuses, 4 Values) come from the same Standard Array data Quick Build reads, since this
 * is deliberately "the quick build menu's Focuses, Values, and Traits" per the design.
 */
const sa = CoreContent.standardArray
const store = useCharacterDraftStore()
const emit = defineEmits<{ finish: [] }>()

const focusTexts = ref<string[]>(Array(sa.focusCount).fill(''))
const valueTexts = ref<string[]>(Array(sa.valueCount).fill(''))
/** "I'll add these later." - lets the player finish without writing any Focus/Value text now;
 * whatever they did type is still kept (blanks are dropped), same as leaving the field alone. */
const skipFocusesValues = ref(false)

const CLASS_TRAIT_NAMES: Record<'Peasant' | 'Merchant' | 'Noble', string[]> = {
  Peasant: ['Commoner', 'Peasant'],
  Merchant: ['Commoner', 'Merchant'],
  Noble: ['Noble'],
}
const traitChoice = ref<'Peasant' | 'Merchant' | 'Noble' | null>(null)
const definingFeatureText = ref('')

const isReady = computed(
  () =>
    (skipFocusesValues.value ||
      (focusTexts.value.every((t) => t.trim()) && valueTexts.value.every((t) => t.trim()))) &&
    !!traitChoice.value &&
    definingFeatureText.value.trim().length > 0,
)

/** Live preview, same pattern as QuickBuildStep/LifepathStageStep. */
watch(
  [focusTexts, valueTexts, traitChoice, definingFeatureText],
  () => {
    const traitNames = traitChoice.value ? [...CLASS_TRAIT_NAMES[traitChoice.value]] : []
    if (definingFeatureText.value.trim()) traitNames.push(`Defining Feature: ${definingFeatureText.value}`)
    store.setPendingPreview({
      focusTexts: focusTexts.value,
      valueTexts: valueTexts.value,
      traitNames,
    })
  },
  { deep: true, immediate: true },
)

function submit() {
  if (!isReady.value || !traitChoice.value) return
  store.applyFocusValueTraitQuickEntry({
    focusTexts: focusTexts.value.filter((t) => t.trim()),
    valueTexts: valueTexts.value.filter((t) => t.trim()),
    traitNames: [...CLASS_TRAIT_NAMES[traitChoice.value]],
    definingFeatureText: definingFeatureText.value,
  })
  emit('finish')
}
</script>

<template>
  <div>
    <h3 class="text-h6 mb-2">Focuses, Values &amp; Traits (Quick Entry)</h3>

    <v-card class="mb-4" variant="outlined">
      <v-card-title>Focuses &amp; Values</v-card-title>
      <v-card-text>
        <v-text-field
          v-for="(_, i) in focusTexts"
          :key="`focus-${i}`"
          v-model="focusTexts[i]"
          :label="`Focus ${i + 1}`"
          density="compact"
        />
        <v-text-field
          v-for="(_, i) in valueTexts"
          :key="`value-${i}`"
          v-model="valueTexts[i]"
          :label="`Value ${i + 1}`"
          density="compact"
        />
        <v-checkbox
          v-model="skipFocusesValues"
          label="I'll add these later."
          density="compact"
          hide-details
          class="skip-checkbox mt-1"
        />
      </v-card-text>
    </v-card>

    <v-card class="mb-4" variant="outlined">
      <v-card-title>Traits</v-card-title>
      <v-card-text>
        <v-radio-group v-model="traitChoice" inline density="compact" label="Starting Trait">
          <v-radio label="Peasant" value="Peasant" />
          <v-radio label="Merchant" value="Merchant" />
          <v-radio label="Noble" value="Noble" />
        </v-radio-group>
        <p class="text-caption text-medium-emphasis mb-2">
          Also unlocks the matching Class Archetype (Peasant/Merchant/Noble) Narrative Talents.
        </p>
        <v-text-field v-model="definingFeatureText" label="Defining Feature (Trait)" density="compact" />
      </v-card-text>
    </v-card>

    <v-btn color="primary" :disabled="!isReady" @click="submit">Continue</v-btn>
  </div>
</template>

<style scoped>
.skip-checkbox :deep(.v-label) {
  font-size: 0.8rem;
}
</style>
