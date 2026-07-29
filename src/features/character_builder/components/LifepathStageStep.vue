<script setup lang="ts">
import { computed, ref } from 'vue'
import { AttributeId, SkillId } from '@/classes/enums'
import type { ILifepathOption, ILifepathSelection, ILifepathStageData } from '@/classes/Lifepath'
import { CoreContent } from '@/io/ContentLoader'
import PointAllocator from './PointAllocator.vue'

const props = defineProps<{ stage: ILifepathStageData; excludeOptionIds?: string[] }>()
const emit = defineEmits<{ confirm: [selection: ILifepathSelection] }>()

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

const selectedOption = computed<ILifepathOption | undefined>(() =>
  props.stage.options.find((o) => o.id === selectedOptionId.value),
)

function isPool(grant: { amount: number; restrictTo?: unknown[] }): boolean {
  return grant.amount > 1 && !grant.restrictTo
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
}

const isReady = computed(() => {
  const option = selectedOption.value
  if (!option) return false
  const attributesResolved = option.grants.attributePoints.every((grant, i) => {
    if (grant.restrictTo?.length === 1) return true
    if (isPool(grant)) return attributePools.value[i]?.every((v) => v !== null) ?? false
    return !!attributeChoices.value[i]
  })
  const skillsResolved = option.grants.skillPoints.every(
    (grant, i) => (grant.restrictTo?.length === 1 ? true : !!skillChoices.value[i]),
  )
  const focusesResolved = focusTexts.value.every((t) => t.trim().length > 0)
  const valueResolved = option.grants.valuePrompt ? valueText.value.trim().length > 0 : true
  return attributesResolved && skillsResolved && focusesResolved && valueResolved
})

const submitted = ref(false)

function confirm() {
  const option = selectedOption.value
  if (!option || !isReady.value || submitted.value) return
  submitted.value = true

  const resolvedAttributePoints: Partial<Record<AttributeId, number>> = {}
  option.grants.attributePoints.forEach((grant, i) => {
    if (isPool(grant)) {
      for (const id of attributePools.value[i] ?? []) {
        if (id) resolvedAttributePoints[id] = (resolvedAttributePoints[id] ?? 0) + 1
      }
      return
    }
    const id = grant.restrictTo?.length === 1 ? grant.restrictTo[0] : attributeChoices.value[i]!
    resolvedAttributePoints[id] = (resolvedAttributePoints[id] ?? 0) + grant.amount
  })

  const resolvedSkillPoints: Partial<Record<SkillId, number>> = {}
  option.grants.skillPoints.forEach((grant, i) => {
    const id = grant.restrictTo?.length === 1 ? grant.restrictTo[0] : skillChoices.value[i]!
    resolvedSkillPoints[id] = (resolvedSkillPoints[id] ?? 0) + grant.amount
  })

  emit('confirm', {
    stageId: props.stage.id,
    optionId: option.id,
    resolvedAttributePoints,
    resolvedSkillPoints,
    focusText: [...focusTexts.value],
    valueText: option.grants.valuePrompt ? valueText.value : undefined,
  })
}
</script>

<template>
  <div>
    <h3 class="text-h6 mb-2">{{ stage.name }}</h3>

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
            :items="grant.restrictTo ? attributeItems.filter((a) => grant.restrictTo!.includes(a.value)) : attributeItems"
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
            :items="grant.restrictTo ? skillItems.filter((s) => grant.restrictTo!.includes(s.value)) : skillItems"
            :label="`Choose Skill for +${grant.amount}`"
            density="compact"
          />
        </div>

        <v-text-field
          v-for="(_, i) in focusTexts"
          :key="`focus-${i}`"
          v-model="focusTexts[i]"
          :label="`Focus ${i + 1}`"
          :placeholder="selectedOption.grants.focusExamples?.join(', ')"
          density="compact"
        />

        <v-text-field
          v-if="selectedOption.grants.valuePrompt"
          v-model="valueText"
          label="Value"
          :hint="selectedOption.grants.valuePrompt"
          persistent-hint
          density="compact"
        />

        <div v-if="selectedOption.grants.trait" class="text-body-2 mb-2">
          Grants Trait: <strong>{{ selectedOption.grants.trait }}</strong>
        </div>

        <v-btn color="primary" :disabled="!isReady || submitted" @click="confirm">Confirm &amp; Continue</v-btn>
      </v-card-text>
    </v-card>
  </div>
</template>
