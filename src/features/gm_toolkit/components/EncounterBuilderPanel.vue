<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useEncounterStore } from '../store/EncounterStore'
import { useNpcBuilderStore } from '../store/NpcBuilderStore'
import EncounterEditor from './EncounterEditor.vue'

const emit = defineEmits<{ openNpcBuilder: [] }>()
const store = useEncounterStore()
const npcStore = useNpcBuilderStore()

onMounted(() => Promise.all([store.load(), npcStore.load()]))

// --- new encounter: must be named before it's created ---
const creating = ref(false)
const newName = ref('')
const newNameError = computed(() => (newName.value.trim() ? null : 'An encounter must have a name.'))
function startCreate() {
  creating.value = true
  newName.value = ''
}
async function create() {
  if (newNameError.value) return
  await store.create(newName.value)
  creating.value = false
}

// --- import ---
const fileInput = ref<HTMLInputElement>()
const importMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-selecting the same file
  if (!file) return
  try {
    importMessage.value = { type: 'success', text: await store.importFromFile(file) }
  } catch (err) {
    importMessage.value = { type: 'error', text: err instanceof Error ? err.message : 'Could not import that file.' }
  }
}
</script>

<template>
  <v-row>
    <v-col cols="12" md="3">
      <div class="d-flex flex-column ga-2 mb-3">
        <v-btn color="primary" prepend-icon="mdi-plus" block @click="startCreate">New Encounter</v-btn>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="handleFile" />
        <v-btn variant="tonal" prepend-icon="mdi-upload" block @click="fileInput?.click()">Import Encounter</v-btn>
      </div>

      <v-alert
        v-if="importMessage"
        :type="importMessage.type"
        variant="tonal"
        density="compact"
        closable
        class="mb-3 text-body-2"
        @click:close="importMessage = null"
      >
        {{ importMessage.text }}
      </v-alert>

      <v-card v-if="creating" variant="outlined" class="mb-3">
        <v-card-text>
          <v-text-field
            v-model="newName"
            label="Encounter name"
            density="compact"
            autofocus
            :error-messages="newName ? (newNameError ?? undefined) : undefined"
            @keydown.enter="create"
          />
          <div class="d-flex justify-end ga-2">
            <v-btn size="small" variant="text" @click="creating = false">Cancel</v-btn>
            <v-btn size="small" color="primary" variant="flat" :disabled="!!newNameError" @click="create">Create</v-btn>
          </div>
        </v-card-text>
      </v-card>

      <p v-if="store.loaded && !store.encounters.length && !creating" class="text-body-2 text-medium-emphasis">
        No encounters yet.
      </p>
      <v-list v-else density="compact">
        <v-list-item
          v-for="e in store.encounters"
          :key="e.id"
          :title="e.name"
          :subtitle="`${e.entries.length} NPC${e.entries.length === 1 ? '' : 's'}`"
          :active="store.selectedId === e.id"
          color="primary"
          prepend-icon="mdi-sword-cross"
          @click="store.selectedId = e.id"
        />
      </v-list>
    </v-col>

    <v-col cols="12" md="9">
      <EncounterEditor v-if="store.selected" :encounter="store.selected" @open-npc-builder="emit('openNpcBuilder')" />
      <p v-else-if="store.encounters.length" class="text-medium-emphasis">Select an encounter on the left.</p>
    </v-col>
  </v-row>
</template>
