<script setup lang="ts">
import { computed, ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import type { ITalentData } from '@/classes/Talent'
import { TalentCategory } from '@/classes/enums'
import MarkdownText from '@/ui/MarkdownText.vue'
import { describeTalentPrerequisite } from '@/ui/describeTalentPrerequisite'

const activeCategory = ref<TalentCategory>(TalentCategory.Narrative)
const searchText = ref('')

/** Groups the index (name/subgroup) by subgroup, in source order. */
const groupSections = computed(() => {
  const entries = CoreContent.talents.index.filter((e) => e.category === activeCategory.value)
  const bySubgroup = new Map<string, string[]>()
  for (const e of entries) {
    if (!bySubgroup.has(e.subgroup)) bySubgroup.set(e.subgroup, [])
    bySubgroup.get(e.subgroup)!.push(e.name)
  }
  const filtered = [...bySubgroup.entries()].map(([subgroup, names]) => ({
    subgroup,
    names: names.filter((n) => !searchText.value.trim() || n.toLowerCase().includes(searchText.value.trim().toLowerCase())),
  }))
  return filtered.filter((s) => s.names.length > 0)
})

const selectedGroupName = ref<string | null>(null)

const allTalents = computed<ITalentData[]>(() =>
  activeCategory.value === TalentCategory.Narrative ? CoreContent.talents.narrative : CoreContent.talents.combat,
)

const selectedGroupTalents = computed(() =>
  selectedGroupName.value ? allTalents.value.filter((t) => t.group === selectedGroupName.value) : [],
)

const selectedGroupFlavorText = computed(() =>
  CoreContent.talents.index.find(
    (e) => e.name === selectedGroupName.value && e.category === activeCategory.value,
  )?.flavorText,
)

function selectCategory(category: TalentCategory) {
  activeCategory.value = category
  selectedGroupName.value = null
}
</script>

<template>
  <div>
    <v-tabs :model-value="activeCategory" class="mb-3" @update:model-value="(v) => selectCategory(v as TalentCategory)">
      <v-tab :text="`Narrative (${CoreContent.talents.narrative.length} abilities)`" :value="TalentCategory.Narrative" />
      <v-tab :text="`Combat (${CoreContent.talents.combat.length} abilities)`" :value="TalentCategory.Combat" />
    </v-tabs>

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
        <div style="max-height: 70vh; overflow-y: auto">
          <div v-for="section in groupSections" :key="section.subgroup" class="mb-3">
            <div class="text-overline text-medium-emphasis">{{ section.subgroup }}</div>
            <v-list density="compact">
              <v-list-item
                v-for="name in section.names"
                :key="name"
                :title="name"
                :active="selectedGroupName === name"
                color="primary"
                @click="selectedGroupName = name"
              />
            </v-list>
          </div>
        </div>
      </v-col>

      <v-col cols="12" md="8">
        <template v-if="selectedGroupTalents.length">
          <h3 class="text-h6 mb-1">{{ selectedGroupName }}</h3>
          <p v-if="selectedGroupFlavorText" class="text-medium-emphasis font-italic mb-3">
            {{ selectedGroupFlavorText }}
          </p>
          <v-card v-for="t in selectedGroupTalents" :key="t.id" variant="outlined" class="mb-2">
            <v-card-title class="d-flex align-center justify-space-between">
              <span>{{ t.name }}</span>
              <v-chip v-if="t.tier" size="small">Tier {{ t.tier }}</v-chip>
            </v-card-title>
            <v-card-subtitle>Requires: {{ describeTalentPrerequisite(t.prerequisites) }}</v-card-subtitle>
            <v-card-text><MarkdownText :source="t.effectText" /></v-card-text>
          </v-card>
        </template>
        <p v-else class="text-medium-emphasis">Select an Archetype or Talent Tree on the left.</p>
      </v-col>
    </v-row>
  </div>
</template>
