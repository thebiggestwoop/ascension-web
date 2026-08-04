<script setup lang="ts">
import { computed } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { Character, computeStatModifiers } from '@/classes/Character'
import { useCharacterDraftStore } from '../store/CharacterDraftStore'

const store = useCharacterDraftStore()
const isFinished = computed(() => store.completedStageIds.includes('finishing_touches'))
const allTalents = [...CoreContent.talents.narrative, ...CoreContent.talents.combat]
const allSpells = [...CoreContent.spells.arcane, ...CoreContent.spells.light, ...CoreContent.spells.dark]
/**
 * Deliberately NOT Character.Deserialize()/toRaw(): those strip Vue's reactive Proxy via
 * structuredClone, so this computed would only re-run when `store.draft` is reassigned
 * wholesale (e.g. reset()) - not when stage actions mutate its fields in place. Constructing
 * directly over the live proxy keeps every nested read tracked as a real dependency.
 */
const character = computed(() => {
  const modifiers = computeStatModifiers(
    store.draft,
    allTalents,
    CoreContent.equipment.armor,
    CoreContent.equipment.general,
    allSpells,
    CoreContent.equipment.shields,
  )
  return new Character(store.draft, modifiers)
})

/**
 * Whichever step is active reports its in-progress picks into store.pendingPreview (see
 * CharacterDraftStore) - merged with the confirmed draft here so the preview reacts to every
 * selection made, not just once that step's Confirm/Finish button is pressed.
 */
const previewedAttributes = computed(() => store.pendingPreview.attributes ?? store.draft.attributes)
const previewedSkills = computed(() => store.pendingPreview.skills ?? store.draft.skills)
const pendingFocusTexts = computed(() => store.pendingPreview.focusTexts.filter((t) => t.trim()))
const pendingValueTexts = computed(() => store.pendingPreview.valueTexts.filter((t) => t.trim()))
const pendingTraitNames = computed(() => store.pendingPreview.traitNames.filter((t) => t.trim()))
</script>

<template>
  <v-card variant="outlined">
    <v-card-title>Character Preview</v-card-title>
    <v-card-text>
      <p class="text-caption text-medium-emphasis mb-3">
        Updates live as you make choices below. Everything shown here still counts toward
        finishing this step - outlined entries just haven't been locked in with Confirm/Finish yet.
      </p>
      <div class="text-subtitle-2 mb-1">Attributes</div>
      <v-row dense class="mb-3">
        <v-col v-for="attr in CoreContent.attributes" :key="attr.id" cols="6" sm="4">
          {{ attr.name }}: <strong>{{ previewedAttributes[attr.id] }}</strong>
          <span
            v-if="previewedAttributes[attr.id] !== store.draft.attributes[attr.id]"
            class="text-caption text-medium-emphasis"
          >
            (was {{ store.draft.attributes[attr.id] }})
          </span>
        </v-col>
      </v-row>

      <div class="text-subtitle-2 mb-1">Skills</div>
      <v-row dense class="mb-3">
        <v-col v-for="skill in CoreContent.skills" :key="skill.id" cols="6" sm="4">
          {{ skill.name }}: <strong>{{ previewedSkills[skill.id] }}</strong>
          <span
            v-if="previewedSkills[skill.id] !== store.draft.skills[skill.id]"
            class="text-caption text-medium-emphasis"
          >
            (was {{ store.draft.skills[skill.id] }})
          </span>
        </v-col>
      </v-row>

      <div class="text-subtitle-2 mb-1">Focuses</div>
      <div class="mb-3">
        <v-chip v-for="(focus, i) in store.draft.focuses" :key="`f-${i}`" class="mr-1 mb-1" size="small">
          {{ focus }}
        </v-chip>
        <v-chip
          v-for="(focus, i) in pendingFocusTexts"
          :key="`pf-${i}`"
          class="mr-1 mb-1"
          size="small"
          variant="outlined"
        >
          {{ focus }}
        </v-chip>
        <span v-if="!store.draft.focuses.length && !pendingFocusTexts.length" class="text-medium-emphasis">
          None yet
        </span>
      </div>

      <div class="text-subtitle-2 mb-1">Values</div>
      <div class="mb-3">
        <div v-for="(value, i) in store.draft.values" :key="`v-${i}`">{{ value.text }}</div>
        <div v-for="(value, i) in pendingValueTexts" :key="`pv-${i}`" class="text-medium-emphasis">
          {{ value }}
        </div>
        <span v-if="!store.draft.values.length && !pendingValueTexts.length" class="text-medium-emphasis">
          None yet
        </span>
      </div>

      <div class="text-subtitle-2 mb-1">Traits</div>
      <div>
        <v-chip
          v-for="(trait, i) in store.draft.traits"
          :key="`t-${i}`"
          class="mr-1 mb-1"
          size="small"
          color="secondary"
        >
          {{ trait.name }}
        </v-chip>
        <v-chip
          v-for="(trait, i) in pendingTraitNames"
          :key="`pt-${i}`"
          class="mr-1 mb-1"
          size="small"
          color="secondary"
          variant="outlined"
        >
          {{ trait }}
        </v-chip>
        <span v-if="!store.draft.traits.length && !pendingTraitNames.length" class="text-medium-emphasis">
          None yet
        </span>
      </div>

      <template v-if="isFinished">
        <div class="text-subtitle-2 mt-3 mb-1">Derived Stats</div>
        <div>Speed: {{ character.speed }}</div>
        <div>Max HP: {{ character.maxHp }} (current: {{ store.draft.currentHp }})</div>
        <div>Willpower: {{ character.maxWillpower }}</div>
        <div>Resistance: {{ character.resistance }}</div>
        <div>Damage Bonus: {{ character.damageBonus }}</div>
        <div>Spell Slots: {{ character.spellSlots }}</div>
      </template>
    </v-card-text>
  </v-card>
</template>
