<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AttributeId, SkillId } from '@/classes/enums'
import type { ICharacterData } from '@/classes/Character'
import type { ITalentData } from '@/classes/Talent'
import { isAllocationDisabledByCeiling } from '@/classes/AllocationCaps'
import { CoreContent } from '@/io/ContentLoader'
import PointAllocator from '@/features/character_builder/components/PointAllocator.vue'
import TalentPicker from '@/features/character_builder/components/TalentPicker.vue'

const props = defineProps<{ modelValue: boolean; character: ICharacterData }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [
    payload: {
      attributeDeltas: Partial<Record<AttributeId, number>>
      skillDeltas: Partial<Record<SkillId, number>>
      focusText?: string
      narrativeTalentIds: string[]
      combatTalentIds: string[]
      removeTalentIds?: string[]
      removeFocusText?: string
      replacementFocusText?: string
    },
  ]
}>()

const attributeItems = CoreContent.attributes.map((a) => ({ title: a.name, value: a.id }))
const skillItems = CoreContent.skills.map((s) => ({ title: s.name, value: s.id }))
const allAttributeIds = CoreContent.attributes.map((a) => a.id as AttributeId)
const allSkillIds = CoreContent.skills.map((s) => s.id as SkillId)

/**
 * Per the rules: "cannot have more than one Attribute above 11 or Skill above 4" until Level
 * 5, "but all characters may only ever have one Attribute at 12 and one Skill at 5" even
 * after. So the ceiling is 11/4 pre-Level-5 (only one may reach it) and 12/5 post-Level-5
 * (11/4 becomes unrestricted since it's no longer the ceiling; only one may reach 12/5).
 */
const ATTRIBUTE_CEILING_BASE = 11
const ATTRIBUTE_CEILING_HIGH = 12
const SKILL_CEILING_BASE = 4
const SKILL_CEILING_HIGH = 5

const newLevel = computed(() => props.character.level + 1)
const row = computed(() => CoreContent.advancement.levelAscensionChart.find((r) => r.level === newLevel.value))
const maxTier = computed(() => (newLevel.value >= CoreContent.advancement.tier3TalentUnlockLevel ? 3 : 2))
const attributeCeiling = computed(() =>
  newLevel.value >= CoreContent.advancement.multipleAt11Or4UnlockLevel ? ATTRIBUTE_CEILING_HIGH : ATTRIBUTE_CEILING_BASE,
)
const skillCeiling = computed(() =>
  newLevel.value >= CoreContent.advancement.multipleAt11Or4UnlockLevel ? SKILL_CEILING_HIGH : SKILL_CEILING_BASE,
)

const attributeAllocations = ref<(AttributeId | null)[]>([])
const skillAllocations = ref<(SkillId | null)[]>([])
const focusText = ref('')
const talentPicks = ref<{ narrativeTalentIds: string[]; combatTalentIds: string[] }>({
  narrativeTalentIds: [],
  combatTalentIds: [],
})

/**
 * "Upon Ascending a Level... You may ALSO do any of the following": these five options are
 * additional to the chart's normal grants, not a replacement for them - each is opt-in via
 * its own checkbox rather than always shown, since most levels most players will just take
 * the chart grants as printed.
 */
const respecAttributeSwap = ref(false)
const respecAttributeDecrease = ref<AttributeId | null>(null)
const respecAttributeIncrease = ref<AttributeId | null>(null)

const respecSkillSwap = ref(false)
const respecSkillDecrease = ref<SkillId | null>(null)
const respecSkillIncrease = ref<SkillId | null>(null)

const respecFocusReplace = ref(false)
const respecFocusOldText = ref<string | null>(null)
const respecFocusNewText = ref('')

const respecNarrativeReplace = ref(false)
const respecNarrativeOldId = ref<string | null>(null)

const respecCombatReplace = ref(false)
const respecCombatOldId = ref<string | null>(null)

/** Resets the form's picks whenever the dialog is (re)opened for a fresh level. */
function reset() {
  attributeAllocations.value = Array(row.value?.attributePoints ?? 0).fill(null)
  skillAllocations.value = Array(row.value?.skillPoints ?? 0).fill(null)
  focusText.value = ''
  talentPicks.value = { narrativeTalentIds: [], combatTalentIds: [] }
  respecAttributeSwap.value = false
  respecAttributeDecrease.value = null
  respecAttributeIncrease.value = null
  respecSkillSwap.value = false
  respecSkillDecrease.value = null
  respecSkillIncrease.value = null
  respecFocusReplace.value = false
  respecFocusOldText.value = null
  respecFocusNewText.value = ''
  respecNarrativeReplace.value = false
  respecNarrativeOldId.value = null
  respecCombatReplace.value = false
  respecCombatOldId.value = null
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) reset()
  },
)

/** Chart Attribute points only - the base the respec swap's own eligibility checks build on. */
const projectedAttributes = computed(() => {
  const result = { ...props.character.attributes }
  for (const id of attributeAllocations.value) {
    if (id) result[id] += 1
  }
  return result
})
const projectedSkills = computed(() => {
  const result = { ...props.character.skills }
  for (const id of skillAllocations.value) {
    if (id) result[id] += 1
  }
  return result
})

/** Chart points + the respec swap's decrease already applied (but not yet the increase) - used
 * to check which Attribute the swap may increase into. */
const attributesAfterDecrease = computed(() => {
  const result = { ...projectedAttributes.value }
  if (respecAttributeSwap.value && respecAttributeDecrease.value) result[respecAttributeDecrease.value] -= 1
  return result
})
const skillsAfterDecrease = computed(() => {
  const result = { ...projectedSkills.value }
  if (respecSkillSwap.value && respecSkillDecrease.value) result[respecSkillDecrease.value] -= 1
  return result
})

/** Full effective Attributes/Skills (chart grants + the respec swap, if both sides are picked) -
 * what Talent prerequisites should actually be checked against. */
const finalAttributes = computed(() => {
  const result = { ...attributesAfterDecrease.value }
  if (respecAttributeSwap.value && respecAttributeIncrease.value) result[respecAttributeIncrease.value] += 1
  return result
})
const finalSkills = computed(() => {
  const result = { ...skillsAfterDecrease.value }
  if (respecSkillSwap.value && respecSkillIncrease.value) result[respecSkillIncrease.value] += 1
  return result
})

function isAttributeDisabled(itemValue: string, slotIndex: number): boolean {
  return isAllocationDisabledByCeiling(
    allAttributeIds,
    props.character.attributes,
    attributeAllocations.value,
    itemValue as AttributeId,
    slotIndex,
    attributeCeiling.value,
  )
}
function isSkillDisabled(itemValue: string, slotIndex: number): boolean {
  return isAllocationDisabledByCeiling(
    allSkillIds,
    props.character.skills,
    skillAllocations.value,
    itemValue as SkillId,
    slotIndex,
    skillCeiling.value,
  )
}

/** "Decrease one Attribute by 1 (to a minimum of 6)". */
const decreaseAttributeItems = computed(() =>
  attributeItems.map((item) => ({ ...item, disabled: projectedAttributes.value[item.value] <= 6 })),
)
/** "...and increase another by 1 (to the level-appropriate maximum)." */
const increaseAttributeItems = computed(() =>
  attributeItems.map((item) => ({
    ...item,
    disabled:
      item.value === respecAttributeDecrease.value ||
      isAllocationDisabledByCeiling(allAttributeIds, attributesAfterDecrease.value, [null], item.value, 0, attributeCeiling.value),
  })),
)
const decreaseSkillItems = computed(() =>
  skillItems.map((item) => ({ ...item, disabled: projectedSkills.value[item.value] <= 1 })),
)
const increaseSkillItems = computed(() =>
  skillItems.map((item) => ({
    ...item,
    disabled:
      item.value === respecSkillDecrease.value ||
      isAllocationDisabledByCeiling(allSkillIds, skillsAfterDecrease.value, [null], item.value, 0, skillCeiling.value),
  })),
)

const focusItems = computed(() => props.character.focuses)

/** "Replace a Narrative Talent with any other you meet the Prerequisites for" - no chain restriction. */
const heldNarrativeTalents = computed<ITalentData[]>(() =>
  CoreContent.talents.narrative.filter((t) => props.character.talentIds.includes(t.id)),
)
/** "Replace a Combat Talent that is not a prerequisite for anything else you have" - excludes
 * any held Combat Talent that some OTHER held Combat Talent's priorTalentId points to. */
const heldCombatTalents = computed<ITalentData[]>(() => {
  const heldSet = new Set(props.character.talentIds)
  const referenced = new Set<string>()
  for (const t of CoreContent.talents.combat) {
    if (heldSet.has(t.id) && t.prerequisites.priorTalentId) referenced.add(t.prerequisites.priorTalentId)
  }
  return CoreContent.talents.combat.filter((t) => heldSet.has(t.id) && !referenced.has(t.id))
})

/** Talents already held, minus whichever is being replaced away this level-up - so the picker
 * can't just re-select the same Talent as its own replacement. */
const heldTalentIdsForPicker = computed(() =>
  props.character.talentIds.filter((id) => id !== respecNarrativeOldId.value && id !== respecCombatOldId.value),
)
const effectiveNarrativeCount = computed(() => (row.value?.narrativeTalents ?? 0) + (respecNarrativeReplace.value ? 1 : 0))
const effectiveCombatCount = computed(() => (row.value?.combatTalents ?? 0) + (respecCombatReplace.value ? 1 : 0))

const isReady = computed(() => {
  if (!row.value) return false
  const attributesResolved = attributeAllocations.value.every((v) => v !== null)
  const skillsResolved = skillAllocations.value.every((v) => v !== null)
  const focusResolved = row.value.newFocus ? focusText.value.trim().length > 0 : true
  const narrativeResolved = talentPicks.value.narrativeTalentIds.length === effectiveNarrativeCount.value
  const combatResolved = talentPicks.value.combatTalentIds.length === effectiveCombatCount.value
  const attributeSwapResolved =
    !respecAttributeSwap.value || (respecAttributeDecrease.value !== null && respecAttributeIncrease.value !== null)
  const skillSwapResolved =
    !respecSkillSwap.value || (respecSkillDecrease.value !== null && respecSkillIncrease.value !== null)
  const focusSwapResolved =
    !respecFocusReplace.value || (respecFocusOldText.value !== null && respecFocusNewText.value.trim().length > 0)
  const narrativeSwapResolved = !respecNarrativeReplace.value || respecNarrativeOldId.value !== null
  const combatSwapResolved = !respecCombatReplace.value || respecCombatOldId.value !== null
  return (
    attributesResolved &&
    skillsResolved &&
    focusResolved &&
    narrativeResolved &&
    combatResolved &&
    attributeSwapResolved &&
    skillSwapResolved &&
    focusSwapResolved &&
    narrativeSwapResolved &&
    combatSwapResolved
  )
})

function confirm() {
  if (!isReady.value || !row.value) return

  const attributeDeltas: Partial<Record<AttributeId, number>> = {}
  for (const id of attributeAllocations.value) {
    if (id) attributeDeltas[id] = (attributeDeltas[id] ?? 0) + 1
  }
  if (respecAttributeSwap.value && respecAttributeDecrease.value && respecAttributeIncrease.value) {
    attributeDeltas[respecAttributeDecrease.value] = (attributeDeltas[respecAttributeDecrease.value] ?? 0) - 1
    attributeDeltas[respecAttributeIncrease.value] = (attributeDeltas[respecAttributeIncrease.value] ?? 0) + 1
  }

  const skillDeltas: Partial<Record<SkillId, number>> = {}
  for (const id of skillAllocations.value) {
    if (id) skillDeltas[id] = (skillDeltas[id] ?? 0) + 1
  }
  if (respecSkillSwap.value && respecSkillDecrease.value && respecSkillIncrease.value) {
    skillDeltas[respecSkillDecrease.value] = (skillDeltas[respecSkillDecrease.value] ?? 0) - 1
    skillDeltas[respecSkillIncrease.value] = (skillDeltas[respecSkillIncrease.value] ?? 0) + 1
  }

  const removeTalentIds: string[] = []
  if (respecNarrativeReplace.value && respecNarrativeOldId.value) removeTalentIds.push(respecNarrativeOldId.value)
  if (respecCombatReplace.value && respecCombatOldId.value) removeTalentIds.push(respecCombatOldId.value)

  emit('confirm', {
    attributeDeltas,
    skillDeltas,
    focusText: row.value.newFocus ? focusText.value : undefined,
    narrativeTalentIds: talentPicks.value.narrativeTalentIds,
    combatTalentIds: talentPicks.value.combatTalentIds,
    removeTalentIds: removeTalentIds.length ? removeTalentIds : undefined,
    removeFocusText: respecFocusReplace.value ? (respecFocusOldText.value ?? undefined) : undefined,
    replacementFocusText: respecFocusReplace.value ? respecFocusNewText.value : undefined,
  })
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="900"
    scrollable
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <v-card v-if="row">
      <v-card-title>Ascend to Level {{ newLevel }}</v-card-title>
      <v-card-text style="max-height: 75vh">
        <p v-if="row.unlocks" class="text-body-2 text-medium-emphasis mb-3">{{ row.unlocks }}</p>

        <template v-if="row.attributePoints > 0">
          <div class="text-subtitle-2 mb-1">Attribute Points</div>
          <p class="text-caption text-medium-emphasis">
            Max {{ attributeCeiling }}, only one Attribute may reach it.
          </p>
          <PointAllocator
            v-model="attributeAllocations"
            :count="row.attributePoints"
            :items="attributeItems"
            label="Choose Attribute"
            :is-item-disabled="isAttributeDisabled"
          />
        </template>

        <template v-if="row.skillPoints > 0">
          <div class="text-subtitle-2 mt-3 mb-1">Skill Points</div>
          <p class="text-caption text-medium-emphasis">Max {{ skillCeiling }}, only one Skill may reach it.</p>
          <PointAllocator
            v-model="skillAllocations"
            :count="row.skillPoints"
            :items="skillItems"
            label="Choose Skill"
            :is-item-disabled="isSkillDisabled"
          />
        </template>

        <template v-if="row.newFocus">
          <div class="text-subtitle-2 mt-3 mb-1">New Focus</div>
          <v-text-field v-model="focusText" label="Focus" density="compact" />
        </template>

        <template v-if="row.narrativeTalents > 0 || row.combatTalents > 0 || effectiveNarrativeCount > 0 || effectiveCombatCount > 0">
          <div class="text-subtitle-2 mt-3 mb-1">Talents</div>
          <TalentPicker
            :attributes="finalAttributes"
            :skills="finalSkills"
            :social-class-id="character.socialClassId"
            :career-id="character.careerId"
            :held-talent-ids="heldTalentIdsForPicker"
            :narrative-count="effectiveNarrativeCount"
            :combat-count="effectiveCombatCount"
            :max-tier="maxTier"
            :level="newLevel"
            @change="(p) => (talentPicks = p)"
          />
        </template>

        <v-divider class="my-4" />
        <div class="text-subtitle-1 mb-1">Instead, You May Also...</div>
        <p class="text-caption text-medium-emphasis mb-2">
          Optional, in addition to the grants above - per Chapter Two's Character Advancement.
        </p>

        <v-checkbox v-model="respecAttributeSwap" label="Swap an Attribute point" density="compact" hide-details />
        <v-row v-if="respecAttributeSwap" dense class="mb-2">
          <v-col cols="6">
            <v-select
              v-model="respecAttributeDecrease"
              :items="decreaseAttributeItems"
              item-props
              label="Decrease"
              density="compact"
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="respecAttributeIncrease"
              :items="increaseAttributeItems"
              item-props
              label="Increase"
              density="compact"
            />
          </v-col>
        </v-row>

        <v-checkbox v-model="respecSkillSwap" label="Swap a Skill point" density="compact" hide-details />
        <v-row v-if="respecSkillSwap" dense class="mb-2">
          <v-col cols="6">
            <v-select v-model="respecSkillDecrease" :items="decreaseSkillItems" item-props label="Decrease" density="compact" />
          </v-col>
          <v-col cols="6">
            <v-select v-model="respecSkillIncrease" :items="increaseSkillItems" item-props label="Increase" density="compact" />
          </v-col>
        </v-row>

        <v-checkbox
          v-model="respecFocusReplace"
          label="Replace a Focus"
          density="compact"
          hide-details
          :disabled="!focusItems.length"
        />
        <v-row v-if="respecFocusReplace" dense class="mb-2">
          <v-col cols="6">
            <v-select
              v-model="respecFocusOldText"
              :items="focusItems"
              label="Replace this Focus"
              density="compact"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="respecFocusNewText" label="With this new Focus" density="compact" />
          </v-col>
        </v-row>

        <v-checkbox
          v-model="respecNarrativeReplace"
          label="Replace a Narrative Talent"
          density="compact"
          hide-details
          :disabled="!heldNarrativeTalents.length"
        />
        <v-select
          v-if="respecNarrativeReplace"
          v-model="respecNarrativeOldId"
          :items="heldNarrativeTalents.map((t) => ({ title: t.name, value: t.id }))"
          label="Replace this Narrative Talent (pick its replacement in Talents above)"
          density="compact"
          class="mb-2"
        />

        <v-checkbox
          v-model="respecCombatReplace"
          label="Replace a Combat Talent (not a prerequisite for anything else you have)"
          density="compact"
          hide-details
          :disabled="!heldCombatTalents.length"
        />
        <v-select
          v-if="respecCombatReplace"
          v-model="respecCombatOldId"
          :items="heldCombatTalents.map((t) => ({ title: `${t.name} (${t.group})`, value: t.id }))"
          label="Replace this Combat Talent (pick its replacement in Talents above)"
          density="compact"
          class="mb-2"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" :disabled="!isReady" @click="confirm">Confirm</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
