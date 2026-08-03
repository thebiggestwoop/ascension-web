<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ICharacterData } from '@/classes/Character'
import { listCharacterIds, loadCharacter, deleteCharacter } from '@/io/Storage'
import { exportCharacterToFile, importCharacterFromFile } from '@/io/CharacterTransfer'

const router = useRouter()
const characters = ref<ICharacterData[]>([])
const loading = ref(true)
const importError = ref<string | null>(null)
const fileInput = ref<HTMLInputElement>()

async function refresh() {
  loading.value = true
  const ids = await listCharacterIds()
  const loaded = await Promise.all(ids.map((id) => loadCharacter(id)))
  characters.value = loaded.filter((c): c is ICharacterData => c !== null)
  loading.value = false
}

async function remove(id: string) {
  await deleteCharacter(id)
  await refresh()
}

function triggerImport() {
  importError.value = null
  fileInput.value?.click()
}

async function handleFileChosen(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = '' // allow re-selecting the same file next time
  if (!file) return
  try {
    await importCharacterFromFile(file)
    await refresh()
  } catch (err) {
    importError.value = err instanceof Error ? err.message : 'Could not import that file.'
  }
}

onMounted(refresh)
</script>

<template>
  <v-container>
    <div class="d-flex align-center justify-space-between mb-3 flex-wrap ga-2">
      <h2 class="text-h5">Characters</h2>
      <div class="d-flex align-center ga-2">
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="handleFileChosen" />
        <v-btn variant="text" @click="triggerImport">Import Character</v-btn>
        <v-btn color="primary" variant="text" to="/builder">New Character</v-btn>
      </div>
    </div>

    <v-alert
      v-if="importError"
      type="error"
      variant="tonal"
      density="compact"
      closable
      class="mb-3"
      @click:close="importError = null"
    >
      {{ importError }}
    </v-alert>

    <p v-if="!loading && characters.length === 0" class="text-medium-emphasis">
      No characters yet. Build one in the Character Builder.
    </p>

    <v-row>
      <v-col v-for="c in characters" :key="c.id" cols="12" sm="6" md="4">
        <v-card variant="outlined" @click="router.push(`/sheet/${c.id}`)">
          <v-card-title>{{ c.name || 'Unnamed Character' }}</v-card-title>
          <v-card-subtitle>Level {{ c.level }}</v-card-subtitle>
          <v-card-text>
            HP {{ c.currentHp }} - Willpower {{ c.currentWillpower }}
          </v-card-text>
          <v-card-actions>
            <v-btn size="small" variant="text" @click.stop="exportCharacterToFile(c)">Export</v-btn>
            <v-spacer />
            <v-btn size="small" variant="text" color="error" @click.stop="remove(c.id)">Delete</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
