<script setup lang="ts">
import { CoreContent } from '@/io/ContentLoader'
import { useCharacterDraftStore } from '../store/CharacterDraftStore'

const store = useCharacterDraftStore()
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
    </v-card-text>
  </v-card>
</template>
