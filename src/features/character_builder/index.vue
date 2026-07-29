<script setup lang="ts">
import { computed, ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { useCharacterDraftStore } from './store/CharacterDraftStore'
import LifepathStageStep from './components/LifepathStageStep.vue'
import FinishingTouchesStep from './components/FinishingTouchesStep.vue'
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
}
</script>

<template>
  <v-container>
    <div class="d-flex align-center justify-space-between mb-1">
      <h2 class="text-h5">Character Builder</h2>
      <v-btn variant="text" size="small" @click="startOver">Start Over</v-btn>
    </div>
    <p class="text-body-2 text-medium-emphasis mb-4">Lifepath Creation, Steps One through Six.</p>

    <v-row>
      <v-col cols="12" md="7">
        <LifepathStageStep
          v-if="!allStagesDone"
          :key="`${currentStage.id}-${pickedOptionIdsForCurrentStage.length}`"
          :stage="currentStage"
          :exclude-option-ids="pickedOptionIdsForCurrentStage"
          @confirm="handleConfirm"
        />
        <FinishingTouchesStep v-else />
      </v-col>
      <v-col cols="12" md="5">
        <CharacterPreview />
      </v-col>
    </v-row>
  </v-container>
</template>
