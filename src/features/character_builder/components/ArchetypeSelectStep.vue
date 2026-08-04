<script setup lang="ts">
import { ref, computed } from 'vue'
import { CoreContent } from '@/io/ContentLoader'

/**
 * "Start from an Archetype": pick a category (e.g. Sword), then a specific pregen Archetype
 * within it (e.g. Hero) - each a fully-built character whose id maps to
 * CoreContent.archetypes.characters. Selecting one hands its id up to the parent, which loads
 * the matching pregen into QuickBuildStep's `prefill` prop.
 */
const emit = defineEmits<{ select: [archetypeId: string] }>()

const categories = CoreContent.archetypes.categories
const selectedCategoryId = ref<string | null>(null)
const selectedCategory = computed(() => categories.find((c) => c.id === selectedCategoryId.value) ?? null)
</script>

<template>
  <div>
    <template v-if="!selectedCategory">
      <p class="text-body-2 text-medium-emphasis mb-4">
        Choose a category, then a pregen character to start from - every field is yours to tweak afterward.
      </p>
      <v-row>
        <v-col v-for="c in categories" :key="c.id" cols="12" sm="6">
          <v-card variant="outlined" @click="selectedCategoryId = c.id">
            <v-card-title>{{ c.name }}</v-card-title>
            <v-card-text>{{ c.description }}</v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <template v-else>
      <div class="d-flex align-center mb-2">
        <v-btn variant="text" size="small" prepend-icon="mdi-arrow-left" @click="selectedCategoryId = null">
          Categories
        </v-btn>
      </div>
      <h3 class="text-h6 mb-1">{{ selectedCategory.name }}</h3>
      <p class="text-body-2 text-medium-emphasis mb-4">{{ selectedCategory.description }}</p>
      <v-row>
        <v-col v-for="a in selectedCategory.archetypes" :key="a.id" cols="12" sm="6">
          <v-card variant="outlined" @click="emit('select', a.id)">
            <v-card-title>{{ a.name }}</v-card-title>
            <v-card-text>{{ a.description }}</v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
