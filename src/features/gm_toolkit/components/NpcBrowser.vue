<script setup lang="ts">
/**
 * Searchable, filterable list of every rulebook NPC class with the selected one's stat block -
 * shared by the NPC Compendium and the NPC Builder's "choose a class" screen. The `selected`
 * slot renders above the stat block (e.g. the Builder's confirm bar).
 */
import { computed, ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import type { INpcData, NpcCategory, NpcTier } from '@/classes/Npc'
import NpcStatBlock from './NpcStatBlock.vue'

defineProps<{ tier: NpcTier | null }>()
const selectedId = defineModel<string | null>({ required: true })
defineSlots<{ selected(props: { npc: INpcData }): unknown }>()

const { classes, types } = CoreContent.npcs

const searchText = ref('')
const typeFilter = ref<string[]>([])
const categoryFilter = ref<NpcCategory | null>(null)

const CATEGORY_SECTIONS: { id: NpcCategory; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'chaff', label: 'Chaff' },
  { id: 'monumental', label: 'Monumental Foes' },
]

const filteredSections = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  const matches = classes.filter(
    (n) =>
      (!q || n.name.toLowerCase().includes(q)) &&
      (!typeFilter.value.length || (n.colorType !== null && typeFilter.value.includes(n.colorType))) &&
      (!categoryFilter.value || n.category === categoryFilter.value),
  )
  return CATEGORY_SECTIONS.map((c) => ({ ...c, npcs: matches.filter((n) => n.category === c.id) })).filter(
    (c) => c.npcs.length,
  )
})

const selectedNpc = computed(() => classes.find((n) => n.id === selectedId.value))

function typeColor(name: string | null): string | undefined {
  return types.find((t) => t.name === name)?.color
}
</script>

<template>
  <v-row>
    <v-col cols="12" md="4">
      <v-text-field
        v-model="searchText"
        label="Search"
        density="compact"
        prepend-inner-icon="mdi-magnify"
        clearable
        class="mb-2"
      />
      <v-select
        v-model="categoryFilter"
        :items="CATEGORY_SECTIONS"
        item-title="label"
        item-value="id"
        label="Category"
        density="compact"
        clearable
        class="mb-2"
      />
      <v-chip-group v-model="typeFilter" multiple column class="mb-2">
        <v-chip v-for="ty in types" :key="ty.id" :value="ty.name" size="small" filter variant="outlined">
          <span class="type-dot mr-1" :style="{ backgroundColor: ty.color }" />
          {{ ty.name }}
        </v-chip>
      </v-chip-group>

      <div style="max-height: 60vh; overflow-y: auto">
        <div v-for="section in filteredSections" :key="section.id" class="mb-3">
          <div class="text-overline text-medium-emphasis">{{ section.label }}</div>
          <v-list density="compact">
            <v-list-item
              v-for="n in section.npcs"
              :key="n.id"
              :title="n.name"
              :subtitle="n.colorType ?? undefined"
              :active="selectedId === n.id"
              color="primary"
              @click="selectedId = n.id"
            >
              <template #prepend>
                <span class="type-dot mr-3" :style="{ backgroundColor: typeColor(n.colorType) ?? 'transparent' }" />
              </template>
            </v-list-item>
          </v-list>
        </div>
        <p v-if="!filteredSections.length" class="text-medium-emphasis">No NPCs match these filters.</p>
      </div>
    </v-col>

    <v-col cols="12" md="8">
      <template v-if="selectedNpc">
        <slot name="selected" :npc="selectedNpc" />
        <NpcStatBlock :npc="selectedNpc" :tier="tier" />
      </template>
      <p v-else class="text-medium-emphasis">Select an NPC on the left.</p>
    </v-col>
  </v-row>
</template>

<style scoped>
.type-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(128, 128, 128, 0.6);
  flex-shrink: 0;
}
</style>
