<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { exportArmyToFile, importArmyFromFile } from '@/io/ArmyTransfer'
import { useArmyStore } from './store/ArmyStore'

const router = useRouter()
const store = useArmyStore()
const confirmingDelete = ref<string | null>(null)

const fileInput = ref<HTMLInputElement>()
const importMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-selecting the same file
  if (!file) return
  try {
    const army = await importArmyFromFile(file)
    await store.loadAll()
    importMessage.value = { type: 'success', text: `Imported "${army.name}".` }
  } catch (err) {
    importMessage.value = { type: 'error', text: err instanceof Error ? err.message : 'Could not import that file.' }
  }
}

onMounted(() => store.loadAll())

</script>

<template>
  <v-container>
    <div class="d-flex align-center justify-space-between mb-3 flex-wrap ga-2">
      <h2 class="text-h5">Armies</h2>
      <div class="d-flex align-center ga-2">
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="handleFile" />
        <v-btn variant="text" prepend-icon="mdi-upload" @click="fileInput?.click()">Import Army</v-btn>
        <v-btn color="primary" variant="text" prepend-icon="mdi-plus" to="/armies/new">New Army</v-btn>
      </div>
    </div>

    <v-alert
      v-if="importMessage"
      :type="importMessage.type"
      variant="tonal"
      density="compact"
      closable
      class="mb-3"
      @click:close="importMessage = null"
    >
      {{ importMessage.text }}
    </v-alert>

    <p v-if="store.loaded && !store.armies.length" class="text-medium-emphasis">
      No armies yet. Create one with New Army.
    </p>

    <v-row>
      <v-col v-for="a in store.armies" :key="a.id" cols="12" sm="6" md="4">
        <v-card variant="outlined" @click="router.push(`/armies/${a.id}`)">
          <v-card-title>{{ a.name }}</v-card-title>
          <v-card-subtitle>Scale {{ a.scale }}</v-card-subtitle>
          <v-card-text>
            {{ a.divisions.length }} division{{ a.divisions.length === 1 ? '' : 's' }}
            <template v-if="a.divisions.some((d) => d.broken)">
              · <span class="text-error">{{ a.divisions.filter((d) => d.broken).length }} Broken</span>
            </template>
            <div class="text-caption text-medium-emphasis mt-1">{{ a.definingFeature }}</div>
          </v-card-text>
          <v-card-actions>
            <v-btn size="small" variant="text" @click.stop="exportArmyToFile(a)">Export</v-btn>
            <v-spacer />
            <template v-if="confirmingDelete === a.id">
              <v-btn size="small" variant="text" @click.stop="confirmingDelete = null">Cancel</v-btn>
              <v-btn size="small" variant="flat" color="error" @click.stop="store.remove(a.id)">Delete</v-btn>
            </template>
            <v-btn v-else size="small" variant="text" color="error" @click.stop="confirmingDelete = a.id">Delete</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
