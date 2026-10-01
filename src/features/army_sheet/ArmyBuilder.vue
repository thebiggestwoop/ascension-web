<script setup lang="ts">
/**
 * Army builder - the four steps of Building an Army (Chapter Nine): Scale, Divisions, Talents,
 * Traits. With an `id` it edits an existing army instead, keeping each kept division's
 * battle state (Morale, Broken, stratagem uses).
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { IArmyData } from '@/classes/Army'
import { MAX_SCALE, armyTraits, createArmy, resetForBattle, startingMorale, talentCount } from '@/classes/Army'
import { CoreContent } from '@/io/ContentLoader'
import { loadArmy } from '@/io/Storage'
import { useArmyStore } from './store/ArmyStore'
import DivisionRecruiter from './components/DivisionRecruiter.vue'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const store = useArmyStore()
const { rules, talents, divisions } = CoreContent.armies

const army = ref<IArmyData>(createArmy())
const loading = ref(!!props.id)
/** Divisions the army already had before this edit (their battle state is kept). */
const originalDivisionIds = new Set<string>()
const step = ref(1)

onMounted(async () => {
  if (!props.id) return
  const existing = await loadArmy(props.id)
  if (existing) {
    army.value = existing
    existing.divisions.forEach((d) => originalDivisionIds.add(d.id))
  }
  loading.value = false
})

const STEPS = [
  { n: 1, title: 'Scale' },
  { n: 2, title: 'Divisions' },
  { n: 3, title: 'Talents' },
  { n: 4, title: 'Traits' },
]

const scaleItems = rules.scale.map((s) => ({ title: `${s.scale} - ${s.armySize}`, value: s.scale }))
const levelItems = Array.from({ length: 13 }, (_, i) => i)
const allowedTalents = computed(() => talentCount(rules, army.value.partyLevel))
const traits = computed(() => armyTraits(army.value, divisions))

// --- step validity ---
const problems = computed<Record<number, string | null>>(() => ({
  1: army.value.name.trim() ? null : 'Give your army a name.',
  2: !army.value.divisions.length
    ? 'Recruit at least one division.'
    : army.value.divisions.length > army.value.scale
      ? `Your army has more divisions than its Scale (${army.value.scale}) allows - remove some or raise its Scale.`
      : army.value.divisions.some((d) => !d.stratagemId)
        ? 'Choose a stratagem for every division.'
        : null,
  3:
    army.value.talentIds.length > allowedTalents.value
      ? `Your army can have ${allowedTalents.value} Talent${allowedTalents.value === 1 ? '' : 's'} at party level ${army.value.partyLevel} - remove some.`
      : army.value.talentIds.length < allowedTalents.value
        ? `Choose ${allowedTalents.value - army.value.talentIds.length} more Talent${allowedTalents.value - army.value.talentIds.length === 1 ? '' : 's'}.`
        : null,
  4: army.value.definingFeature.trim() ? null : 'Give your army a Defining Feature.',
}))
const firstProblem = computed(() => STEPS.find((s) => problems.value[s.n]))

function toggleTalent(id: string) {
  const ids = army.value.talentIds
  if (ids.includes(id)) army.value.talentIds = ids.filter((t) => t !== id)
  else if (ids.length < allowedTalents.value) army.value.talentIds = [...ids, id]
}

const saving = ref(false)
async function finish() {
  if (firstProblem.value) {
    step.value = firstProblem.value.n
    return
  }
  saving.value = true
  army.value.name = army.value.name.trim()
  army.value.definingFeature = army.value.definingFeature.trim()
  if (!props.id) {
    resetForBattle(army.value, rules)
  } else {
    const morale = startingMorale(army.value, rules)
    for (const d of army.value.divisions) if (!originalDivisionIds.has(d.id)) d.morale = morale
  }
  await store.save(army.value)
  router.push(`/armies/${army.value.id}`)
}
</script>

<template>
  <v-container>
    <div class="d-flex align-center flex-wrap ga-2 mb-3">
      <v-btn variant="text" prepend-icon="mdi-arrow-left" :to="id ? `/armies/${id}` : '/armies'">
        {{ id ? 'Back to sheet' : 'Armies' }}
      </v-btn>
      <h2 class="text-h5">{{ id ? `Edit ${army.name || 'Army'}` : 'New Army' }}</h2>
    </div>

    <p v-if="loading" class="text-medium-emphasis">Loading...</p>
    <template v-else>
      <div class="d-flex flex-wrap ga-2 mb-4">
        <v-btn
          v-for="s in STEPS"
          :key="s.n"
          :variant="step === s.n ? 'flat' : 'tonal'"
          :color="step === s.n ? 'primary' : undefined"
          size="small"
          @click="step = s.n"
        >
          <v-icon v-if="!problems[s.n]" start icon="mdi-check" size="small" />
          Step {{ s.n }}: {{ s.title }}
        </v-btn>
      </div>

      <!-- Step One: Scale -->
      <div v-if="step === 1" style="max-width: 720px">
        <p class="text-body-2 text-medium-emphasis mb-4">
          The GM sets the scale of the players' army depending on the narrative circumstances of the army. As a
          general rule, for every point of scale, the army doubles in size, and an army may have a number of
          divisions equal to its scale.
        </p>
        <v-text-field v-model="army.name" label="Army name" density="compact" class="mb-2" />
        <v-select v-model="army.scale" :items="scaleItems" label="Scale" density="compact" class="mb-2" />
        <v-select
          v-model="army.partyLevel"
          :items="levelItems"
          label="Party level"
          density="compact"
          :hint="`At this level your army gains ${allowedTalents} Talent${allowedTalents === 1 ? '' : 's'}.`"
          persistent-hint
        />
        <p class="text-caption text-medium-emphasis mt-3">Scale goes up to {{ MAX_SCALE }}; most armies are Scale 3-6.</p>
      </div>

      <!-- Step Two: Divisions -->
      <DivisionRecruiter v-else-if="step === 2" v-model="army" />

      <!-- Step Three: Talents -->
      <div v-else-if="step === 3">
        <v-alert
          :type="army.talentIds.length === allowedTalents ? 'success' : 'info'"
          variant="tonal"
          density="compact"
          class="mb-4 text-body-2"
        >
          {{ army.talentIds.length }} of {{ allowedTalents }} Talent{{ allowedTalents === 1 ? '' : 's' }} chosen (party level
          {{ army.partyLevel }}). Your army gains another Talent when the party reaches levels 4, 8, and 12.
        </v-alert>
        <v-row>
          <v-col v-for="t in talents" :key="t.id" cols="12" md="6">
            <v-card
              :variant="army.talentIds.includes(t.id) ? 'tonal' : 'outlined'"
              :color="army.talentIds.includes(t.id) ? 'primary' : undefined"
              class="h-100"
              :disabled="!army.talentIds.includes(t.id) && army.talentIds.length >= allowedTalents"
              @click="toggleTalent(t.id)"
            >
              <v-card-title class="d-flex align-center text-subtitle-1">
                <v-icon
                  :icon="army.talentIds.includes(t.id) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
                  size="small"
                  class="mr-2"
                />
                {{ t.name }}
              </v-card-title>
              <v-card-text class="text-body-2" style="white-space: pre-line">{{ t.text }}</v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Step Four: Traits -->
      <div v-else style="max-width: 720px">
        <p class="text-body-2 text-medium-emphasis mb-3">
          Your army gains a Trait for each unique Division that it has. It also gains a Defining Feature: a unique
          Trait decided upon by all players, likely relating to the army's purpose or its highest authority.
        </p>
        <v-text-field
          v-model="army.definingFeature"
          label="Defining Feature"
          placeholder="e.g. The King's Army"
          density="compact"
          class="mb-3"
        />
        <div class="text-overline text-medium-emphasis">Traits</div>
        <div class="d-flex flex-wrap ga-2 mb-4">
          <v-chip v-for="t in traits" :key="t" size="small">{{ t }}</v-chip>
          <span v-if="!traits.length" class="text-body-2 text-medium-emphasis">Recruit divisions to gain Traits.</span>
        </div>
      </div>

      <v-divider class="my-4" />
      <div class="d-flex flex-wrap align-center ga-2">
        <v-btn v-if="step > 1" variant="text" @click="step--">Back</v-btn>
        <v-spacer />
        <span v-if="problems[step]" class="text-body-2 text-error">{{ problems[step] }}</span>
        <v-btn v-if="step < 4" color="primary" variant="flat" @click="step++">Next</v-btn>
        <v-btn v-else color="primary" variant="flat" :loading="saving" @click="finish">
          {{ id ? 'Save Army' : 'Create Army' }}
        </v-btn>
      </div>
      <p v-if="step === 4 && firstProblem && firstProblem.n !== 4" class="text-body-2 text-error text-right mt-2">
        Step {{ firstProblem.n }} still needs attention: {{ problems[firstProblem.n] }}
      </p>
    </template>
  </v-container>
</template>
