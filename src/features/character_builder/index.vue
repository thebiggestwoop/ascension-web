<script setup lang="ts">
import { computed, ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { useCharacterDraftStore } from './store/CharacterDraftStore'
import LifepathStageStep from './components/LifepathStageStep.vue'
import FinishingTouchesStep from './components/FinishingTouchesStep.vue'
import QuickBuildStep from './components/QuickBuildStep.vue'
import CharacterPreview from './components/CharacterPreview.vue'
import type { ILifepathSelection, ILifepathStageData } from '@/classes/Lifepath'

const stages: ILifepathStageData[] = [
  CoreContent.lifepath.socialClass,
  CoreContent.lifepath.upbringing,
  CoreContent.lifepath.education,
  CoreContent.lifepath.career,
  CoreContent.lifepath.lifeEvents,
]
const currentStageIndex = ref(0)
const pickedOptionIdsForCurrentStage = ref<string[]>([])
const store = useCharacterDraftStore()
const creationMethod = ref<'lifepath' | 'quick_build' | null>(null)

const currentStage = computed(() => stages[currentStageIndex.value])
const allStagesDone = computed(() => currentStageIndex.value >= stages.length)

function handleConfirm(selection: ILifepathSelection) {
  // Guards against a stray double-emit (e.g. a leftover event from a just-unmounted
  // instance) re-applying a stage that's already been advanced past.
  if (selection.stageId !== currentStage.value?.id) return
  store.applyStage(currentStage.value, selection)
  pickedOptionIdsForCurrentStage.value.push(selection.optionId)
  if (pickedOptionIdsForCurrentStage.value.length >= currentStage.value.selectCount) {
    currentStageIndex.value++
    pickedOptionIdsForCurrentStage.value = []
  }
}

function startOver() {
  store.reset()
  currentStageIndex.value = 0
  pickedOptionIdsForCurrentStage.value = []
  creationMethod.value = null
}
</script>

<template>
  <v-container>
    <div class="d-flex align-center justify-space-between mb-1">
      <h2 class="text-h5">Character Builder</h2>
      <v-btn variant="text" size="small" @click="startOver">Start Over</v-btn>
    </div>

    <template v-if="!creationMethod">
      <p class="text-body-2 text-medium-emphasis mb-4">Choose how you'd like to create your character.</p>
      <v-row>
        <v-col cols="12" sm="6">
          <v-card variant="outlined" @click="creationMethod = 'lifepath'">
            <v-card-title>Lifepath Creation</v-card-title>
            <v-card-text>
              The full six-step process (Social Class through Finishing Touches) that shapes your character
              through the story of their life.
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6">
          <v-card variant="outlined" @click="creationMethod = 'quick_build'">
            <v-card-title>Quick Build</v-card-title>
            <v-card-text>
              Assign Attributes and Skills from a Standard Array and jump straight to Focuses, Values,
              Talents, and Equipment - a faster alternative for experienced players.
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <v-row v-else>
      <v-col cols="12" md="7">
        <template v-if="creationMethod === 'lifepath'">
          <LifepathStageStep
            v-if="!allStagesDone"
            :key="`${currentStage.id}-${pickedOptionIdsForCurrentStage.length}`"
            :stage="currentStage"
            :exclude-option-ids="pickedOptionIdsForCurrentStage"
            @confirm="handleConfirm"
          />
          <FinishingTouchesStep v-else />
        </template>
        <QuickBuildStep v-else />
      </v-col>
      <v-col cols="12" md="5">
        <CharacterPreview />
      </v-col>
    </v-row>
  </v-container>
</template>
