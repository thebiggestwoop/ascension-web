<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AttributeId, SkillId } from '@/classes/enums'
import type { ILifepathOption, ILifepathSelection, ILifepathStageData } from '@/classes/Lifepath'
import { AUTO_TRAIT_STAGE_LABEL } from '@/classes/Lifepath'
import { CoreContent } from '@/io/ContentLoader'
import MarkdownText from '@/ui/MarkdownText.vue'
import { useCharacterDraftStore } from '../store/CharacterDraftStore'
import PointAllocator from './PointAllocator.vue'

const props = defineProps<{
  stage: ILifepathStageData
  excludeOptionIds?: string[]
  /** Start from an Archetype's Lifepath sub-flow: the Archetype's own Attributes/Skills are
   * already fixed, so this stage's Attribute/Skill Point grants are hidden and never applied -
   * only its Trait/Focus/Value grants (identical to the normal Lifepath flow otherwise). */
  skipAttributeSkillGrants?: boolean
}>()
const emit = defineEmits<{ confirm: [selection: ILifepathSelection]; back: [] }>()
const store = useCharacterDraftStore()

const attributeItems = CoreContent.attributes.map((a) => ({ title: a.name, value: a.id }))
const skillItems = CoreContent.skills.map((s) => ({ title: s.name, value: s.id }))

function attributeName(id: AttributeId): string {
  return CoreContent.attributes.find((a) => a.id === id)?.name ?? id
}

const availableOptions = computed(() =>
  props.stage.options.filter((o) => !props.excludeOptionIds?.includes(o.id)),
)

const selectedOptionId = ref<string | null>(null)
/** Single-select resolution, keyed by grant index: fixed grants never need an entry here. */
const attributeChoices = ref<Record<number, AttributeId | null>>({})
const skillChoices = ref<Record<number, SkillId | null>>({})
/** Free-split pools (amount > 1, no restrictTo), keyed by grant index: one pick per point. */
const attributePools = ref<Record<number, (AttributeId | null)[]>>({})
const focusTexts = ref<string[]>([])
const valueText = ref('')
/** Whether the player opted into the stage's `optionalTrait` (e.g. "Born out of wedlock"). */
const optionalTraitChecked = ref(false)

const selectedOption = computed<ILifepathOption | undefined>(() =>
  props.stage.options.find((o) => o.id === selectedOptionId.value),
)

/** The auto-generated "{Label}: {option name}" Trait this stage grants, if any (Social Class
 * uses explicit `trait`/`additionalTrait` fields instead - see AUTO_TRAIT_STAGE_LABEL). */
const autoTraitName = computed(() => {
  const label = AUTO_TRAIT_STAGE_LABEL[props.stage.id]
  return label && selectedOption.value ? `${label}: ${selectedOption.value.name}` : undefined
})

/** Every Trait name this selection will grant, combined - shared by the live preview and the
 * template's "Grants Trait" display so the two can never disagree. */
const previewTraitNames = computed(() => {
  const option = selectedOption.value
  if (!option) return []
  const names: string[] = []
  if (option.grants.trait) names.push(option.grants.trait)
  if (option.grants.additionalTrait) names.push(option.grants.additionalTrait)
  if (autoTraitName.value) names.push(autoTraitName.value)
  if (optionalTraitChecked.value && props.stage.optionalTrait) names.push(props.stage.optionalTrait.trait)
  return names
})

function isPool(grant: { amount: number; restrictTo?: unknown[] }): boolean {
  return grant.amount > 1 && !grant.restrictTo
}

/**
 * Ids already locked in by an earlier *fixed* grant (restrictTo of exactly one) in the same
 * Attribute/Skill Points array - e.g. Upbringing's "+1 [X] (fixed), then +1 to a second
 * Attribute of your choice": the free pick must exclude X, since "a second" means a different
 * one. Grants before a pool/multi-option grant don't affect it (no data currently needs that),
 * so this only ever changes what a genuinely free (no restrictTo) single-point select offers.
 */
function fixedIdsBefore<T extends string>(grants: { amount: number; restrictTo?: T[] }[], uptoIndex: number): T[] {
  const ids: T[] = []
  for (let j = 0; j < uptoIndex; j++) {
    const g = grants[j]
    if (g.restrictTo?.length === 1) ids.push(g.restrictTo[0])
  }
  return ids
}

function attributeItemsForGrant(i: number) {
  const option = selectedOption.value
  if (!option) return attributeItems
  const grant = option.grants.attributePoints[i]
  const excluded = fixedIdsBefore(option.grants.attributePoints, i)
  const base = grant.restrictTo ? attributeItems.filter((a) => grant.restrictTo!.includes(a.value)) : attributeItems
  return base.filter((a) => !excluded.includes(a.value))
}
function skillItemsForGrant(i: number) {
  const option = selectedOption.value
  if (!option) return skillItems
  const grant = option.grants.skillPoints[i]
  const excluded = fixedIdsBefore(option.grants.skillPoints, i)
  const base = grant.restrictTo ? skillItems.filter((s) => grant.restrictTo!.includes(s.value)) : skillItems
  return base.filter((s) => !excluded.includes(s.value))
}

function selectOption(option: ILifepathOption) {
  submitted.value = false
  selectedOptionId.value = option.id
  attributeChoices.value = {}
  skillChoices.value = {}
  attributePools.value = {}
  option.grants.attributePoints.forEach((grant, i) => {
    if (isPool(grant)) attributePools.value[i] = Array(grant.amount).fill(null)
  })
  focusTexts.value = Array(option.grants.focusCount).fill('')
  valueText.value = ''
  optionalTraitChecked.value = false
}

const isReady = computed(() => {
  const option = selectedOption.value
  if (!option) return false
  const attributesResolved =
    props.skipAttributeSkillGrants ||
    option.grants.attributePoints.every((grant, i) => {
      if (grant.restrictTo?.length === 1) return true
      if (isPool(grant)) return attributePools.value[i]?.every((v) => v !== null) ?? false
      return !!attributeChoices.value[i]
    })
  const skillsResolved =
    props.skipAttributeSkillGrants ||
    option.grants.skillPoints.every((grant, i) => (grant.restrictTo?.length === 1 ? true : !!skillChoices.value[i]))
  const focusesResolved = focusTexts.value.every((t) => t.trim().length > 0)
  const valueResolved = option.grants.valuePrompt ? valueText.value.trim().length > 0 : true
  return attributesResolved && skillsResolved && focusesResolved && valueResolved
})

/** This option's resolved Attribute/Skill grants as currently filled in - shared by the live
 * preview (below) and confirm() so the two can never disagree. Always empty when
 * skipAttributeSkillGrants is set (Start from an Archetype's Lifepath sub-flow). */
const previewAttributeDeltas = computed<Partial<Record<AttributeId, number>>>(() => {
  const option = selectedOption.value
  if (!option || props.skipAttributeSkillGrants) return {}
  const result: Partial<Record<AttributeId, number>> = {}
  option.grants.attributePoints.forEach((grant, i) => {
    if (isPool(grant)) {
      for (const id of attributePools.value[i] ?? []) {
        if (id) result[id] = (result[id] ?? 0) + 1
      }
      return
    }
    const id = grant.restrictTo?.length === 1 ? grant.restrictTo[0] : attributeChoices.value[i]
    if (id) result[id] = (result[id] ?? 0) + grant.amount
  })
  return result
})
const previewSkillDeltas = computed<Partial<Record<SkillId, number>>>(() => {
  const option = selectedOption.value
  if (!option || props.skipAttributeSkillGrants) return {}
  const result: Partial<Record<SkillId, number>> = {}
  option.grants.skillPoints.forEach((grant, i) => {
    const id = grant.restrictTo?.length === 1 ? grant.restrictTo[0] : skillChoices.value[i]
    if (id) result[id] = (result[id] ?? 0) + grant.amount
  })
  return result
})

const previewAttributes = computed(() => {
  const result = { ...store.draft.attributes }
  for (const [id, amount] of Object.entries(previewAttributeDeltas.value)) {
    result[id as AttributeId] += amount ?? 0
  }
  return result
})
const previewSkills = computed(() => {
  const result = { ...store.draft.skills }
  for (const [id, amount] of Object.entries(previewSkillDeltas.value)) {
    result[id as SkillId] += amount ?? 0
  }
  return result
})

/** Reports this stage's in-progress picks to CharacterPreview immediately, rather than only
 * once "Confirm & Continue" is pressed. */
watch(
  [previewAttributes, previewSkills, focusTexts, valueText, selectedOption, previewTraitNames],
  () => {
    store.setPendingPreview({
      attributes: previewAttributes.value,
      skills: previewSkills.value,
      focusTexts: focusTexts.value,
      valueTexts: valueText.value.trim() ? [valueText.value] : [],
      traitNames: previewTraitNames.value,
    })
  },
  { deep: true, immediate: true },
)

const submitted = ref(false)

function confirm() {
  const option = selectedOption.value
  if (!option || !isReady.value || submitted.value) return
  submitted.value = true

  emit('confirm', {
    stageId: props.stage.id,
    optionId: option.id,
    resolvedAttributePoints: previewAttributeDeltas.value,
    resolvedSkillPoints: previewSkillDeltas.value,
    focusText: [...focusTexts.value],
    valueText: option.grants.valuePrompt ? valueText.value : undefined,
    optionalTraitGranted: optionalTraitChecked.value,
  })
}
</script>

<template>
  <div>
    <v-btn variant="text" size="small" prepend-icon="mdi-arrow-left" class="mb-2" @click="emit('back')">
      Back
    </v-btn>
    <h3 class="text-h6 mb-2">{{ stage.name }}</h3>
    <MarkdownText v-if="stage.notes" :source="stage.notes" class="text-body-2 text-medium-emphasis mb-3" />

    <v-row>
      <v-col v-for="option in availableOptions" :key="option.id" cols="12" sm="6">
        <v-card
          :variant="selectedOptionId === option.id ? 'tonal' : 'outlined'"
          :color="selectedOptionId === option.id ? 'primary' : undefined"
          @click="selectOption(option)"
        >
          <v-card-title>{{ option.name }}</v-card-title>
          <v-card-text>{{ option.description }}</v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card v-if="selectedOption" class="mt-4" variant="outlined">
      <v-card-text>
        <template v-if="!skipAttributeSkillGrants">
        <template v-for="(grant, i) in selectedOption.grants.attributePoints" :key="`attr-${i}`">
          <div v-if="grant.restrictTo?.length === 1" class="mb-3">
            +{{ grant.amount }} {{ attributeName(grant.restrictTo[0]) }} (fixed)
          </div>
          <PointAllocator
            v-else-if="isPool(grant)"
            v-model="attributePools[i]"
            :count="grant.amount"
            :items="attributeItems"
            label="Choose Attribute"
          />
          <v-select
            v-else
            v-model="attributeChoices[i]"
            :items="attributeItemsForGrant(i)"
            :label="`Choose Attribute for +${grant.amount}`"
            density="compact"
            class="mb-3"
          />
        </template>

        <div v-for="(grant, i) in selectedOption.grants.skillPoints" :key="`skill-${i}`" class="mb-3">
          <template v-if="grant.restrictTo?.length === 1">
            +{{ grant.amount }} skill (fixed)
          </template>
          <v-select
            v-else
            v-model="skillChoices[i]"
            :items="skillItemsForGrant(i)"
            :label="`Choose Skill for +${grant.amount}`"
            density="compact"
          />
        </div>
        </template>

        <v-text-field
          v-for="(_, i) in focusTexts"
          :key="`focus-${i}`"
          v-model="focusTexts[i]"
          :label="`Focus ${i + 1}`"
          :hint="selectedOption.grants.focusExamples?.length ? `Ideas: ${selectedOption.grants.focusExamples.join(', ')}` : undefined"
          persistent-hint
          density="compact"
          class="mb-2"
        />

        <v-text-field
          v-if="selectedOption.grants.valuePrompt"
          v-model="valueText"
          label="Value"
          :hint="selectedOption.grants.valuePrompt"
          persistent-hint
          density="compact"
        />

        <v-checkbox
          v-if="stage.optionalTrait"
          v-model="optionalTraitChecked"
          :label="stage.optionalTrait.label"
          density="compact"
          hide-details="auto"
          class="mb-2"
        />

        <div v-if="previewTraitNames.length" class="text-body-2 mb-2">
          Grants Trait{{ previewTraitNames.length > 1 ? 's' : '' }}:
          <strong>{{ previewTraitNames.join(', ') }}</strong>
        </div>

        <v-btn color="primary" :disabled="!isReady || submitted" @click="confirm">Confirm &amp; Continue</v-btn>
      </v-card-text>
    </v-card>
  </div>
</template>
