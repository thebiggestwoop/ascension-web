<script setup lang="ts">
/** NPC Builder's "New NPC" screen: browse the classes like the compendium, then confirm one. */
import { computed, ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import type { NpcTier } from '@/classes/Npc'
import { useNpcBuilderStore } from '../store/NpcBuilderStore'
import NpcBrowser from './NpcBrowser.vue'

const emit = defineEmits<{ done: [] }>()
const store = useNpcBuilderStore()

const selectedId = ref<string | null>(null)
const tier = ref<NpcTier>(1)
const name = ref('')
/** Whether the name is still the auto-suggested one (so picking another class can replace it). */
const nameIsSuggested = ref(true)

/** The class name, numbered if an NPC already uses it ("Glaiveman 2"). */
function suggestName(className: string): string {
  if (!store.isNameTaken(className)) return className
  let i = 2
  while (store.isNameTaken(`${className} ${i}`)) i++
  return `${className} ${i}`
}

watch(selectedId, (id) => {
  const cls = CoreContent.npcs.classes.find((n) => n.id === id)
  if (cls && (nameIsSuggested.value || !name.value.trim())) {
    name.value = suggestName(cls.name)
    nameIsSuggested.value = true
  }
})

const nameError = computed(() => {
  if (!name.value.trim()) return 'Give the NPC a name.'
  if (store.isNameTaken(name.value)) return 'Another NPC already has this name.'
  return null
})

async function create() {
  if (nameError.value || !selectedId.value) return
  await store.create(selectedId.value, name.value, tier.value)
  emit('done')
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-3 mb-3">
      <v-btn variant="text" prepend-icon="mdi-arrow-left" @click="emit('done')">Cancel</v-btn>
      <h3 class="text-h6">New NPC: choose a class</h3>
      <v-spacer />
      <span class="text-body-2 text-medium-emphasis">Tier</span>
      <v-btn-toggle v-model="tier" density="compact" variant="outlined" divided mandatory>
        <v-btn :value="1">1</v-btn>
        <v-btn :value="2">2</v-btn>
        <v-btn :value="3">3</v-btn>
      </v-btn-toggle>
    </div>

    <NpcBrowser v-model="selectedId" :tier="tier">
      <template #selected="{ npc }">
        <v-card variant="tonal" color="primary" class="mb-3">
          <v-card-text class="d-flex flex-wrap align-start ga-3">
            <v-text-field
              v-model="name"
              label="Name"
              density="compact"
              :error-messages="nameError ?? undefined"
              class="flex-grow-1"
              style="min-width: 200px"
              @update:model-value="nameIsSuggested = false"
              @keydown.enter="create"
            />
            <v-btn color="primary" variant="flat" class="mt-1" :disabled="!!nameError" @click="create">
              Create Tier {{ tier }} {{ npc.name }}
            </v-btn>
          </v-card-text>
        </v-card>
      </template>
    </NpcBrowser>
  </div>
</template>
