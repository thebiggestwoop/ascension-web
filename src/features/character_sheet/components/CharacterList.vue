<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ICharacterData } from '@/classes/Character'
import { listCharacterIds, loadCharacter, deleteCharacter } from '@/io/Storage'

const router = useRouter()
const characters = ref<ICharacterData[]>([])
const loading = ref(true)

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

onMounted(refresh)
</script>

<template>
  <v-container>
    <div class="d-flex align-center justify-space-between mb-3">
      <h2 class="text-h5">Characters</h2>
      <v-btn color="primary" variant="text" to="/builder">New Character</v-btn>
    </div>

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
            <v-spacer />
            <v-btn size="small" variant="text" color="error" @click.stop="remove(c.id)">Delete</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
