<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AttributeId, SkillId } from '@/classes/enums'
import type { ICharacterData } from '@/classes/Character'
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

/** Resets the form's picks whenever the dialog is (re)opened for a fresh level. */
function reset() {
  attributeAllocations.value = Array(row.value?.attributePoints ?? 0).fill(null)
  skillAllocations.value = Array(row.value?.skillPoints ?? 0).fill(null)
  focusText.value = ''
  talentPicks.value = { narrativeTalentIds: [], combatTalentIds: [] }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) reset()
  },
)

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

const isReady = computed(() => {
  if (!row.value) return false
  const attributesResolved = attributeAllocations.value.every((v) => v !== null)
  const skillsResolved = skillAllocations.value.every((v) => v !== null)
  const focusResolved = row.value.newFocus ? focusText.value.trim().length > 0 : true
  const narrativeResolved = talentPicks.value.narrativeTalentIds.length === row.value.narrativeTalents
  const combatResolved = talentPicks.value.combatTalentIds.length === row.value.combatTalents
  return attributesResolved && skillsResolved && focusResolved && narrativeResolved && combatResolved
})

function confirm() {
  if (!isReady.value || !row.value) return

  const attributeDeltas: Partial<Record<AttributeId, number>> = {}
  for (const id of attributeAllocations.value) {
    if (id) attributeDeltas[id] = (attributeDeltas[id] ?? 0) + 1
  }
  const skillDeltas: Partial<Record<SkillId, number>> = {}
  for (const id of skillAllocations.value) {
    if (id) skillDeltas[id] = (skillDeltas[id] ?? 0) + 1
  }

  emit('confirm', {
    attributeDeltas,
    skillDeltas,
    focusText: row.value.newFocus ? focusText.value : undefined,
    narrativeTalentIds: talentPicks.value.narrativeTalentIds,
    combatTalentIds: talentPicks.value.combatTalentIds,
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

        <template v-if="row.narrativeTalents > 0 || row.combatTalents > 0">
          <div class="text-subtitle-2 mt-3 mb-1">Talents</div>
          <TalentPicker
            :attributes="projectedAttributes"
            :skills="projectedSkills"
            :social-class-id="character.socialClassId"
            :career-id="character.careerId"
            :held-talent-ids="character.talentIds"
            :narrative-count="row.narrativeTalents"
            :combat-count="row.combatTalents"
            :max-tier="maxTier"
            :level="newLevel"
            @change="(p) => (talentPicks = p)"
          />
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" :disabled="!isReady" @click="confirm">Confirm</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
