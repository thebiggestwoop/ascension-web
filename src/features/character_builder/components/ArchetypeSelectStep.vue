<script setup lang="ts">
import { CoreContent } from '@/io/ContentLoader'

/**
 * "Start from an Archetype": pick a pregen character (e.g. Hero) from its group (e.g. Sword) -
 * each a fully-built character whose id maps to CoreContent.archetypes.characters. Groups are
 * collapsible accordion panels (all collapsed by default) rather than a separate drill-down
 * screen, so every group's name/description is visible at a glance and browsing doesn't need
 * a "back" step of its own. Selecting an Archetype hands its id up to the parent, which loads
 * the matching pregen into ArchetypePreviewStep.
 */
const emit = defineEmits<{ select: [archetypeId: string] }>()

const categories = CoreContent.archetypes.categories
</script>

<template>
  <div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Choose a pregen character to start from - every field is yours to tweak afterward.
    </p>
    <v-expansion-panels variant="accordion" multiple>
      <v-expansion-panel v-for="c in categories" :key="c.id">
        <v-expansion-panel-title>
          <div>
            <div class="text-subtitle-1">{{ c.name }}</div>
            <div class="text-caption text-medium-emphasis">{{ c.description }}</div>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-row>
            <v-col v-for="a in c.archetypes" :key="a.id" cols="12" sm="6">
              <v-card variant="outlined" @click="emit('select', a.id)">
                <v-card-title>{{ a.name }}</v-card-title>
                <v-card-text>{{ a.description }}</v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>
