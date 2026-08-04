<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { useCharacterDraftStore } from './store/CharacterDraftStore'
import LifepathStageStep from './components/LifepathStageStep.vue'
import FinishingTouchesStep from './components/FinishingTouchesStep.vue'
import QuickBuildStep from './components/QuickBuildStep.vue'
import ArchetypeSelectStep from './components/ArchetypeSelectStep.vue'
import ArchetypePreviewStep from './components/ArchetypePreviewStep.vue'
import ArchetypeQuickEntryStep from './components/ArchetypeQuickEntryStep.vue'
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
const creationMethod = ref<'lifepath' | 'quick_build' | 'archetype' | null>(null)

/**
 * "Start from an Archetype" runs its own four-step sequence, independent of the Lifepath/
 * Quick Build methods above: pick a pregen (ArchetypeSelectStep) -> review it read-only
 * (ArchetypePreviewStep) -> choose how to pick Focuses/Values/Traits (Lifepath's own five
 * stages, minus Attribute/Skill grants, or a flat Quick Entry form) -> Finishing Touches
 * (QuickBuildStep, pre-filled from the Archetype, Focuses/Values/Traits hidden since Step
 * Two already applied them).
 */
const selectedArchetypeId = ref<string | null>(null)
const selectedArchetypeData = computed(() =>
  selectedArchetypeId.value ? CoreContent.archetypes.characters[selectedArchetypeId.value] : undefined,
)
const archetypePhase = ref<'preview' | 'focus_value_trait_choice' | 'lifepath' | 'quick_entry' | 'finishing_touches'>(
  'preview',
)

function selectArchetype(id: string) {
  selectedArchetypeId.value = id
  archetypePhase.value = 'preview'
}

function chooseFocusValueTraitMethod(method: 'lifepath' | 'quick_entry') {
  if (method === 'lifepath') {
    currentStageIndex.value = 0
    pickedOptionIdsForCurrentStage.value = []
  }
  archetypePhase.value = method
}

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
    if (currentStageIndex.value >= stages.length && creationMethod.value === 'archetype') {
      archetypePhase.value = 'finishing_touches'
    }
  }
}

function startOver() {
  store.reset()
  currentStageIndex.value = 0
  pickedOptionIdsForCurrentStage.value = []
  creationMethod.value = null
  selectedArchetypeId.value = null
  archetypePhase.value = 'preview'
}

// The draft store is a singleton that outlives this page (e.g. it's still holding the last
// character's talents/equipment/focuses after "View Character Sheet" navigates away) - reset it
// every time this page is freshly entered so a new character never inherits leftover state from
// whichever character was last built. Stages mounted/swapped *within* an active build (Lifepath
// stage-to-stage, or Lifepath -> Finishing Touches) don't remount this component, so this never
// fires mid-build.
onMounted(() => store.reset())
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
        <v-col cols="12" sm="4">
          <v-card variant="outlined" @click="creationMethod = 'lifepath'">
            <v-card-title>Lifepath Creation</v-card-title>
            <v-card-text>
              The full six-step process (Social Class through Finishing Touches) that shapes your character
              through the story of their life.
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="4">
          <v-card variant="outlined" @click="creationMethod = 'quick_build'">
            <v-card-title>Quick Build</v-card-title>
            <v-card-text>
              Assign Attributes and Skills from a Standard Array and jump straight to Focuses, Values,
              Talents, and Equipment - a faster alternative for experienced players.
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="4">
          <v-card variant="outlined" @click="creationMethod = 'archetype'">
            <v-card-title>Start from an Archetype</v-card-title>
            <v-card-text>
              Pick a pregen character built around a weapon and playstyle, then tweak anything you like -
              a quick way to jump straight into playing.
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <template v-else-if="creationMethod === 'archetype' && !selectedArchetypeData">
      <ArchetypeSelectStep @select="selectArchetype" />
    </template>

    <template v-else-if="creationMethod === 'archetype' && archetypePhase === 'preview'">
      <ArchetypePreviewStep
        :archetype="selectedArchetypeData!"
        @continue="archetypePhase = 'focus_value_trait_choice'"
      />
    </template>

    <template v-else-if="creationMethod === 'archetype' && archetypePhase === 'focus_value_trait_choice'">
      <p class="text-body-2 text-medium-emphasis mb-4">
        How would you like to choose Focuses, Values, and Traits?
      </p>
      <v-row>
        <v-col cols="12" sm="6">
          <v-card variant="outlined" @click="chooseFocusValueTraitMethod('lifepath')">
            <v-card-title>Lifepath (Recommended)</v-card-title>
            <v-card-text>
              Step through Social Class, Upbringing, Education, Career, and Life Events for their
              Trait/Focus/Value grants - the same choices as full Lifepath Creation, just without
              its Attribute/Skill points (the Archetype's own are already set).
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6">
          <v-card variant="outlined" @click="chooseFocusValueTraitMethod('quick_entry')">
            <v-card-title>Quick Entry</v-card-title>
            <v-card-text>
              Skip the narrative steps and fill in Focuses, Values, and a starting Trait directly -
              the same fields Quick Build itself uses.
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

        <template v-else-if="creationMethod === 'archetype' && archetypePhase === 'lifepath'">
          <LifepathStageStep
            :key="`archetype-${currentStage.id}-${pickedOptionIdsForCurrentStage.length}`"
            :stage="currentStage"
            :exclude-option-ids="pickedOptionIdsForCurrentStage"
            skip-attribute-skill-grants
            @confirm="handleConfirm"
          />
        </template>

        <ArchetypeQuickEntryStep
          v-else-if="creationMethod === 'archetype' && archetypePhase === 'quick_entry'"
          @finish="archetypePhase = 'finishing_touches'"
        />

        <QuickBuildStep
          v-else-if="creationMethod === 'archetype' && archetypePhase === 'finishing_touches'"
          :prefill="selectedArchetypeData"
          :archetype-id="selectedArchetypeId ?? undefined"
          archetype-finishing-touches-only
        />

        <QuickBuildStep v-else-if="creationMethod === 'quick_build'" />
      </v-col>
      <v-col cols="12" md="5">
        <CharacterPreview />
      </v-col>
    </v-row>
  </v-container>
</template>
