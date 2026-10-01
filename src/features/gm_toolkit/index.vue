<script setup lang="ts">
import { ref } from 'vue'
import NpcCompendiumPanel from './components/NpcCompendiumPanel.vue'
import NpcBuilderPanel from './components/NpcBuilderPanel.vue'
import EncounterBuilderPanel from './components/EncounterBuilderPanel.vue'

const activeSection = ref('npcs')
</script>

<template>
  <v-container fluid>
    <h2 class="text-h5 mb-3">GM Toolkit</h2>

    <v-tabs v-model="activeSection" class="mb-4">
      <v-tab text="NPC Compendium" value="npcs" />
      <v-tab text="NPC Builder" value="builder" />
      <v-tab text="Encounter Builder" value="encounters" />
    </v-tabs>

    <v-window v-model="activeSection">
      <v-window-item value="npcs"><NpcCompendiumPanel /></v-window-item>
      <v-window-item value="builder"><NpcBuilderPanel /></v-window-item>
      <v-window-item value="encounters">
        <EncounterBuilderPanel @open-npc-builder="activeSection = 'builder'" />
      </v-window-item>
    </v-window>
  </v-container>
</template>
