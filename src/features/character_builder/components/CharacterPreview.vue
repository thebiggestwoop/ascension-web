<script setup lang="ts">
import { computed } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { Character, computeStatModifiers } from '@/classes/Character'
import { useCharacterDraftStore } from '../store/CharacterDraftStore'

const store = useCharacterDraftStore()
const isFinished = computed(() => store.completedStageIds.includes('finishing_touches'))
const allTalents = [...CoreContent.talents.narrative, ...CoreContent.talents.combat]
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
  )
  return new Character(store.draft, modifiers)
})
</script>

<template>
  <v-card variant="outlined">
    <v-card-title>Character Preview</v-card-title>
    <v-card-text>
      <div class="text-subtitle-2 mb-1">Attributes</div>
      <v-row dense class="mb-3">
        <v-col v-for="attr in CoreContent.attributes" :key="attr.id" cols="6" sm="4">
          {{ attr.name }}: <strong>{{ store.draft.attributes[attr.id] }}</strong>
        </v-col>
      </v-row>

      <div class="text-subtitle-2 mb-1">Skills</div>
      <v-row dense class="mb-3">
        <v-col v-for="skill in CoreContent.skills" :key="skill.id" cols="6" sm="4">
          {{ skill.name }}: <strong>{{ store.draft.skills[skill.id] }}</strong>
        </v-col>
      </v-row>

      <div class="text-subtitle-2 mb-1">Focuses</div>
      <div class="mb-3">
        <v-chip v-for="(focus, i) in store.draft.focuses" :key="i" class="mr-1 mb-1" size="small">
          {{ focus }}
        </v-chip>
        <span v-if="!store.draft.focuses.length" class="text-medium-emphasis">None yet</span>
      </div>

      <div class="text-subtitle-2 mb-1">Values</div>
      <div class="mb-3">
        <div v-for="(value, i) in store.draft.values" :key="i">{{ value.text }}</div>
        <span v-if="!store.draft.values.length" class="text-medium-emphasis">None yet</span>
      </div>

      <div class="text-subtitle-2 mb-1">Traits</div>
      <div>
        <v-chip v-for="(trait, i) in store.draft.traits" :key="i" class="mr-1 mb-1" size="small" color="secondary">
          {{ trait.name }}
        </v-chip>
        <span v-if="!store.draft.traits.length" class="text-medium-emphasis">None yet</span>
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
