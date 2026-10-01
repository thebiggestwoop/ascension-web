<script setup lang="ts">
import { ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import type { NpcTier } from '@/classes/Npc'
import NpcBrowser from './NpcBrowser.vue'
import NpcTypeChip from './NpcTypeChip.vue'
import NpcEntryList from './NpcEntryList.vue'

const { classes, types, templates } = CoreContent.npcs

const activeView = ref<'npcs' | 'templates' | 'types'>('npcs')
/** null = "All": show tiered values in the rulebook's A/B/C notation. */
const tier = ref<NpcTier | null>(1)
const selectedNpcId = ref<string | null>(null)
</script>

<template>
  <div>
    <v-tabs v-model="activeView" class="mb-3">
      <v-tab :text="`NPCs (${classes.length})`" value="npcs" />
      <v-tab text="Templates" value="templates" />
      <v-tab text="NPC Types" value="types" />
    </v-tabs>

    <div v-if="activeView !== 'types'" class="d-flex align-center flex-wrap ga-2 mb-3">
      <span class="text-body-2 text-medium-emphasis">Tier</span>
      <v-btn-toggle v-model="tier" density="compact" variant="outlined" divided mandatory>
        <v-btn :value="1">1</v-btn>
        <v-btn :value="2">2</v-btn>
        <v-btn :value="3">3</v-btn>
        <v-btn :value="null">All</v-btn>
      </v-btn-toggle>
      <span class="text-caption text-medium-emphasis">
        <template v-for="(tr, i) in templates.tiers.tiers" :key="tr.tier">
          {{ i ? ' · ' : '' }}Tier {{ tr.tier }}: levels {{ tr.levels }}
        </template>
      </span>
    </div>

    <NpcBrowser v-if="activeView === 'npcs'" v-model="selectedNpcId" :tier="tier" />

    <div v-else-if="activeView === 'templates'">
      <p class="text-body-2 text-medium-emphasis mb-3">
        Templates are added on top of an NPC's class to make it harder to fight.
      </p>
      <v-row>
        <v-col v-for="tpl in templates.templates" :key="tpl.id" cols="12" md="4">
          <v-card variant="outlined" class="h-100">
            <v-card-title class="d-flex flex-wrap align-center ga-2">
              <span>{{ tpl.name }}</span>
              <v-chip v-if="tpl.massCombatOnly" size="small" variant="tonal">Mass Combat</v-chip>
              <v-chip v-if="tpl.encounterWeight" size="small" variant="tonal">Counts as {{ tpl.encounterWeight }} enemies</v-chip>
            </v-card-title>
            <v-card-subtitle class="text-wrap font-italic">{{ tpl.description }}</v-card-subtitle>
            <v-card-text>
              <NpcEntryList title="Features" :entries="tpl.features" :tier="tier" />
              <NpcEntryList title="Optional Features" :entries="tpl.optionalFeatures" :tier="tier" />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <div v-else>
      <v-card v-for="ty in types" :key="ty.id" variant="outlined" class="mb-2">
        <v-card-text class="d-flex align-start ga-3">
          <div class="type-chip-cell">
            <NpcTypeChip :type-name="ty.name" />
          </div>
          <span class="text-body-2">{{ ty.description }}</span>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.type-chip-cell {
  flex: 0 0 120px;
}
</style>
