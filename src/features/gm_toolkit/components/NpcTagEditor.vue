<script setup lang="ts">
/**
 * An NPC's custom tags: removable chips, plus a picker listing every existing tag not yet on
 * this NPC and, when the typed text isn't an existing tag, an "Add new tag" option.
 */
import { computed, nextTick, ref } from 'vue'
import type { ICustomNpcData } from '@/classes/CustomNpc'
import { useNpcBuilderStore } from '../store/NpcBuilderStore'

const props = defineProps<{ npc: ICustomNpcData }>()
const store = useNpcBuilderStore()

const NEW_PREFIX = '\u0000new:'
const search = ref('')
const picked = ref<string | null>(null)

const typed = computed(() => search.value.trim().replace(/\s+/g, ' '))

const items = computed(() => {
  const applied = new Set(props.npc.customTags.map((t) => t.toLowerCase()))
  const existing = store.tagRegistry
    .filter((t) => !applied.has(t.toLowerCase()))
    .map((t) => ({ title: t, value: t }))
  const q = typed.value.toLowerCase()
  const isNew = q && !store.tagRegistry.some((t) => t.toLowerCase() === q)
  return isNew ? [...existing, { title: `Add new tag "${typed.value}"`, value: NEW_PREFIX + typed.value }] : existing
})

async function choose(value: string | null) {
  if (!value) return
  const tag = value.startsWith(NEW_PREFIX) ? value.slice(NEW_PREFIX.length) : value
  await store.addTag(props.npc.id, tag)
  await nextTick()
  picked.value = null
  search.value = ''
}

/** Enter adds the exact typed text (an existing tag or a new one). */
function addTyped() {
  if (!typed.value) return
  const existing = store.tagRegistry.find((t) => t.toLowerCase() === typed.value.toLowerCase())
  choose(existing ?? NEW_PREFIX + typed.value)
}
</script>

<template>
  <div>
    <div v-if="npc.customTags.length" class="d-flex flex-wrap ga-1 mb-3">
      <v-chip
        v-for="tag in npc.customTags"
        :key="tag"
        size="small"
        prepend-icon="mdi-tag-outline"
        closable
        :close-label="`Remove tag ${tag}`"
        @click:close="store.removeTag(npc.id, tag)"
      >
        {{ tag }}
      </v-chip>
    </div>
    <p v-else class="text-body-2 text-medium-emphasis mb-3">No tags yet.</p>

    <v-autocomplete
      v-model="picked"
      v-model:search="search"
      :items="items"
      :label="store.tagRegistry.length ? 'Add a tag' : 'Create a tag'"
      :placeholder="store.tagRegistry.length ? 'Choose a tag or type a new one' : 'Type a tag name'"
      prepend-inner-icon="mdi-tag-plus-outline"
      density="compact"
      hide-details
      :menu-props="{ maxHeight: 300 }"
      @update:model-value="choose"
      @keydown.enter.prevent="addTyped"
    >
      <template #item="{ props: itemProps, item }">
        <v-list-item
          v-bind="itemProps"
          :prepend-icon="item.value.startsWith(NEW_PREFIX) ? 'mdi-plus' : 'mdi-tag-outline'"
        />
      </template>
      <template #no-data>
        <v-list-item
          :title="store.tagRegistry.length ? 'Every existing tag is already on this NPC. Type to add a new one.' : 'Type a name to create your first tag.'"
          class="text-medium-emphasis"
        />
      </template>
    </v-autocomplete>
  </div>
</template>
