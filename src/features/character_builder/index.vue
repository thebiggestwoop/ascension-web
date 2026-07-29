<script setup lang="ts">
import { computed, ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { useCharacterDraftStore } from './store/CharacterDraftStore'
import LifepathStageStep from './components/LifepathStageStep.vue'
import CharacterPreview from './components/CharacterPreview.vue'
import type { ILifepathSelection, ILifepathStageData } from '@/classes/Lifepath'

const stages: ILifepathStageData[] = [CoreContent.lifepath.socialClass, CoreContent.lifepath.upbringing]
const currentStageIndex = ref(0)
const store = useCharacterDraftStore()

const currentStage = computed(() => stages[currentStageIndex.value])
const isComplete = computed(() => currentStageIndex.value >= stages.length)

function handleConfirm(selection: ILifepathSelection) {
  store.applyStage(currentStage.value, selection)
  currentStageIndex.value++
}
</script>

<template>
  <v-container>
    <h2 class="text-h5 mb-1">Character Builder</h2>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Vertical-slice preview: Steps One and Two of Lifepath Creation only.
    </p>

    <v-row>
      <v-col cols="12" md="7">
        <LifepathStageStep
          v-if="!isComplete"
          :key="currentStage.id"
          :stage="currentStage"
          @confirm="handleConfirm"
        />
        <v-alert v-else type="success" variant="tonal">
          Steps 1-2 complete. Education, Career, Life Events, and Finishing Touches aren't
          built yet.
        </v-alert>
      </v-col>
      <v-col cols="12" md="5">
        <CharacterPreview />
      </v-col>
    </v-row>
  </v-container>
</template>
