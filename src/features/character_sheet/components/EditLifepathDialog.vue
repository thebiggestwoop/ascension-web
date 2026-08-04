<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ICharacterData, ITrait } from '@/classes/Character'
import type { ILifepathOption, ILifepathStageData } from '@/classes/Lifepath'
import { AUTO_TRAIT_STAGE_LABEL } from '@/classes/Lifepath'
import { CoreContent } from '@/io/ContentLoader'

/**
 * A stripped-down version of the Lifepath wizard's option picker, reachable from the
 * character sheet's Traits card - lets any character (most usefully a Quick Build one,
 * which starts with none of these beyond Social Class) retroactively pick or swap which
 * Social Class/Upbringing/Education/Career/Life Event option they took. Only the Lifepath
 * Trait(s) that option grants change - Attributes, Skills, Focuses, and Values are never
 * touched here. A stage a held Talent currently depends on (via a `trait`/`career`
 * prerequisite) is locked, since swapping it away would invalidate a Talent already held.
 */
const props = defineProps<{ modelValue: boolean; character: ICharacterData }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [payload: { traits: ITrait[]; careerId?: string }]
}>()

const allTalents = [...CoreContent.talents.narrative, ...CoreContent.talents.combat]

interface ISlot {
  key: string
  label: string
  stage: ILifepathStageData
  /** Trait name(s) an option of this stage grants - Social Class grants two (its general
   * Noble/Commoner Trait plus a specific rank), every other stage grants one auto-labeled
   * "{Label}: {option name}" Trait (see AUTO_TRAIT_STAGE_LABEL). */
  grantedNames: (option: ILifepathOption) => string[]
  isCareer: boolean
}

function autoSlot(stage: ILifepathStageData, key: string, label: string, isCareer = false): ISlot {
  const autoLabel = AUTO_TRAIT_STAGE_LABEL[stage.id]!
  return { key, label, stage, grantedNames: (o) => [`${autoLabel}: ${o.name}`], isCareer }
}

const singleSlots: ISlot[] = [
  {
    key: 'social_class',
    label: 'Social Class',
    stage: CoreContent.lifepath.socialClass,
    grantedNames: (o) => [o.grants.trait, o.grants.additionalTrait].filter((n): n is string => !!n),
    isCareer: false,
  },
  autoSlot(CoreContent.lifepath.upbringing, 'upbringing', 'Upbringing'),
  autoSlot(CoreContent.lifepath.education, 'education', 'Education'),
  autoSlot(CoreContent.lifepath.career, 'career', 'Career', true),
]
/** Life Events grants two picks from the same option list (`selectCount: 2`) - modeled as
 * two independent slots sharing one vocabulary, resolved from `character.traits` in
 * whichever order the two "Life Event: ..." Traits happen to appear. */
const lifeEventSlots: ISlot[] = [
  autoSlot(CoreContent.lifepath.lifeEvents, 'life_event_0', 'Life Event 1'),
  autoSlot(CoreContent.lifepath.lifeEvents, 'life_event_1', 'Life Event 2'),
]
const allSlots = [...singleSlots, ...lifeEventSlots]

/** The option each Life Event slot currently holds, matched in Trait-array order so the two
 * slots never both claim the same held Trait. */
const lifeEventMatches = computed(() => {
  const vocab = new Map(CoreContent.lifepath.lifeEvents.options.map((o) => [`Life Event: ${o.name}`, o]))
  const found: ILifepathOption[] = []
  for (const t of props.character.traits) {
    const option = vocab.get(t.name)
    if (option) found.push(option)
  }
  return found
})

/** Re-derived from the character's actual current Traits every time this opens - not from
 * creationRecord, which a Quick Build character won't have and which could drift from
 * hand-edited Traits anyway. */
const currentOptionIds = computed<Record<string, string | null>>(() => {
  const held = new Set(props.character.traits.map((t) => t.name))
  const result: Record<string, string | null> = {}
  for (const slot of singleSlots) {
    const match = slot.stage.options.find((o) => {
      const names = slot.grantedNames(o)
      return names.length > 0 && names.every((n) => held.has(n))
    })
    result[slot.key] = match?.id ?? null
  }
  result.life_event_0 = lifeEventMatches.value[0]?.id ?? null
  result.life_event_1 = lifeEventMatches.value[1]?.id ?? null
  return result
})

const selectedOptionIds = ref<Record<string, string | null>>({})
watch(
  () => props.modelValue,
  (open) => {
    if (open) selectedOptionIds.value = { ...currentOptionIds.value }
  },
  { immediate: true },
)

function optionFor(slot: ISlot, optionId: string | null): ILifepathOption | undefined {
  return optionId ? slot.stage.options.find((o) => o.id === optionId) : undefined
}

/**
 * Trait name(s) this slot is currently, actually contributing right now - what a held
 * Talent's prerequisite would be checked against. Single-slot stages intersect the full
 * stage vocabulary against currently-held Traits rather than requiring an exact option
 * match, so a Quick Build character's partial state (e.g. the general "Noble" Trait with
 * no specific rank chosen) still locks correctly even though no option matches it exactly.
 * Life Event slots have no such ambiguity (each option grants exactly one distinct name),
 * so they use the already-resolved exact match instead.
 */
function currentGrantedNames(slot: ISlot): string[] {
  if (lifeEventSlots.includes(slot)) {
    const option = optionFor(slot, currentOptionIds.value[slot.key])
    return option ? slot.grantedNames(option) : []
  }
  const held = new Set(props.character.traits.map((t) => t.name))
  const vocab = slot.stage.options.flatMap((o) => slot.grantedNames(o))
  return [...new Set(vocab.filter((n) => held.has(n)))]
}

function lockingTalents(slot: ISlot) {
  const names = currentGrantedNames(slot)
  const heldTalentIds = new Set(props.character.talentIds)
  return allTalents.filter((t) => {
    if (!heldTalentIds.has(t.id)) return false
    if (t.prerequisites.trait && names.includes(t.prerequisites.trait)) return true
    if (slot.isCareer && t.prerequisites.career && t.prerequisites.career === props.character.careerId) return true
    return false
  })
}
function isLocked(slot: ISlot): boolean {
  return lockingTalents(slot).length > 0
}

function selectedOptionDescription(slot: ISlot): string | undefined {
  return optionFor(slot, selectedOptionIds.value[slot.key])?.description
}

function save() {
  let traits = [...props.character.traits]
  let careerId = props.character.careerId
  const removeNames = (names: string[]) => {
    traits = traits.filter((t) => !names.includes(t.name))
  }
  const addNames = (names: string[]) => {
    for (const n of names) traits.push({ name: n })
  }

  for (const slot of singleSlots) {
    const newId = selectedOptionIds.value[slot.key]
    const oldId = currentOptionIds.value[slot.key]
    if (newId === oldId || isLocked(slot)) continue
    // Only one slot ever exists per single-slot stage, so it's safe to clear every Trait
    // name that ANY of its options could have granted, not just the currently-held one -
    // this also cleans up a Quick Build character's partial match (e.g. a lone "Noble"
    // Trait with no specific rank) instead of leaving it behind alongside the new pick.
    removeNames(slot.stage.options.flatMap((o) => slot.grantedNames(o)))
    const newOption = optionFor(slot, newId)
    if (newOption) addNames(slot.grantedNames(newOption))
    if (slot.isCareer) careerId = newId ?? undefined
  }

  for (const slot of lifeEventSlots) {
    const newId = selectedOptionIds.value[slot.key]
    const oldId = currentOptionIds.value[slot.key]
    if (newId === oldId || isLocked(slot)) continue
    // Two slots share one vocabulary here, so only remove THIS slot's own previously-held
    // name - removing the whole vocabulary would also wipe the sibling slot's pick.
    const oldOption = optionFor(slot, oldId)
    if (oldOption) removeNames(slot.grantedNames(oldOption))
    const newOption = optionFor(slot, newId)
    if (newOption) addNames(slot.grantedNames(newOption))
  }

  emit('change', { traits, careerId })
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="700"
    scrollable
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <v-card>
      <v-card-title>Edit Lifepath</v-card-title>
      <v-card-text style="max-height: 75vh">
        <p class="text-body-2 text-medium-emphasis mb-4">
          Swap which Lifepath options this character took - only the Lifepath Traits those options grant
          change here; Attributes, Skills, Focuses, and Values are untouched. A stage a held Talent
          currently depends on is locked, since swapping it away would invalidate that Talent.
        </p>

        <div v-for="slot in allSlots" :key="slot.key" class="mb-5">
          <div class="d-flex align-center justify-space-between mb-1" style="gap: 8px">
            <span class="text-subtitle-2">{{ slot.label }}</span>
            <v-tooltip v-if="isLocked(slot)" location="top">
              <template #activator="{ props: activatorProps }">
                <v-chip v-bind="activatorProps" size="small" color="warning" variant="tonal" prepend-icon="mdi-lock">
                  Locked
                </v-chip>
              </template>
              <span>Required by: {{ lockingTalents(slot).map((t) => t.name).join(', ') }}</span>
            </v-tooltip>
          </div>
          <v-select
            v-model="selectedOptionIds[slot.key]"
            :items="slot.stage.options.map((o) => ({ title: o.name, value: o.id }))"
            :disabled="isLocked(slot)"
            placeholder="Not yet chosen"
            density="compact"
            clearable
            hide-details
          />
          <p v-if="selectedOptionDescription(slot)" class="text-caption text-medium-emphasis mt-1">
            {{ selectedOptionDescription(slot) }}
          </p>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" @click="save">Save Changes</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
