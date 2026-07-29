<script setup lang="ts">
import { ref } from 'vue'
import AttributesSkillsPanel from './components/AttributesSkillsPanel.vue'
import LifepathPanel from './components/LifepathPanel.vue'
import EquipmentPanel from './components/EquipmentPanel.vue'
import TalentsPanel from './components/TalentsPanel.vue'
import SpellsPanel from './components/SpellsPanel.vue'
import AdvancementPanel from './components/AdvancementPanel.vue'

const activeSection = ref('lifepath')
</script>

<template>
  <v-container fluid>
    <h2 class="text-h5 mb-1">Compendium</h2>
    <p class="text-body-2 text-medium-emphasis mb-3">
      A rules reference for Ascension Beta 0.8, sourced directly from the bundled content.
    </p>

    <v-tabs v-model="activeSection" class="mb-4">
      <v-tab text="Lifepath" value="lifepath" />
      <v-tab text="Attributes & Skills" value="attributes-skills" />
      <v-tab text="Equipment" value="equipment" />
      <v-tab text="Talents" value="talents" />
      <v-tab text="Spells" value="spells" />
      <v-tab text="Advancement" value="advancement" />
    </v-tabs>

    <v-window v-model="activeSection">
      <v-window-item value="lifepath"><LifepathPanel /></v-window-item>
      <v-window-item value="attributes-skills"><AttributesSkillsPanel /></v-window-item>
      <v-window-item value="equipment"><EquipmentPanel /></v-window-item>
      <v-window-item value="talents"><TalentsPanel /></v-window-item>
      <v-window-item value="spells"><SpellsPanel /></v-window-item>
      <v-window-item value="advancement"><AdvancementPanel /></v-window-item>
    </v-window>
  </v-container>
</template>
