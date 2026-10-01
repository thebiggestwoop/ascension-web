<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { useNpcBuilderStore } from '../store/NpcBuilderStore'
import NewNpcPicker from './NewNpcPicker.vue'
import NpcEditor from './NpcEditor.vue'

const store = useNpcBuilderStore()
const creating = ref(false)
/** Show only NPCs carrying every one of these custom tags. */
const tagFilter = ref<string[]>([])

onMounted(() => store.load())

const items = computed(() =>
  store.npcs
    .filter((n) => tagFilter.value.every((t) => n.customTags.includes(t)))
    .map((n) => {
    const base = CoreContent.npcs.classes.find((c) => c.id === n.baseNpcId)
    const template = CoreContent.npcs.templates.templates.find((t) => t.id === n.templateId)
    return {
      id: n.id,
      name: n.name,
      subtitle: [base?.name, `Tier ${n.tier}`, template?.name].filter(Boolean).join(' · '),
      color: CoreContent.npcs.types.find((t) => t.name === base?.colorType)?.color,
      tags: n.customTags,
    }
  }),
)

/** Only offer tags that at least one NPC actually has. */
const usedTags = computed(() => store.tagRegistry.filter((t) => store.npcs.some((n) => n.customTags.includes(t))))
</script>

<template>
  <NewNpcPicker v-if="creating" @done="creating = false" />
  <div v-else>
    <v-row>
      <v-col cols="12" md="3">
        <v-btn color="primary" prepend-icon="mdi-plus" block class="mb-3" @click="creating = true">New NPC</v-btn>
        <p v-if="store.loaded && !store.npcs.length" class="text-body-2 text-medium-emphasis">
          No NPCs yet. Create one to start building.
        </p>
        <template v-else>
          <v-chip-group v-if="usedTags.length" v-model="tagFilter" multiple column class="mb-1">
            <v-chip
              v-for="t in usedTags"
              :key="t"
              :value="t"
              size="small"
              filter
              variant="outlined"
              prepend-icon="mdi-tag-outline"
            >
              {{ t }}
            </v-chip>
          </v-chip-group>
          <p v-if="!items.length" class="text-body-2 text-medium-emphasis">No NPCs have all of these tags.</p>
        <v-list density="compact">
          <v-list-item
            v-for="n in items"
            :key="n.id"
            :title="n.name"
            :subtitle="n.subtitle"
            :active="store.selectedId === n.id"
            color="primary"
            @click="store.selectedId = n.id"
          >
            <template #prepend>
              <span class="type-dot mr-3" :style="{ backgroundColor: n.color ?? 'transparent' }" />
            </template>
            <div v-if="n.tags.length" class="d-flex flex-wrap ga-1 mt-1">
              <v-chip v-for="t in n.tags" :key="t" size="x-small" variant="outlined">{{ t }}</v-chip>
            </div>
          </v-list-item>
        </v-list>
        </template>
      </v-col>

      <v-col cols="12" md="9">
        <NpcEditor v-if="store.selected" :npc="store.selected" />
        <p v-else-if="store.npcs.length" class="text-medium-emphasis">Select an NPC on the left.</p>
      </v-col>
    </v-row>
  </div>
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
