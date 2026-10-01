<script setup lang="ts">
import { ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import QuickReferencePanel from './components/QuickReferencePanel.vue'
import AttributesSkillsPanel from './components/AttributesSkillsPanel.vue'
import LifepathPanel from './components/LifepathPanel.vue'
import AdvancementPanel from './components/AdvancementPanel.vue'
import RulesDocumentPanel from './components/RulesDocumentPanel.vue'
import EquipmentPanel from './components/EquipmentPanel.vue'
import TalentsPanel from './components/TalentsPanel.vue'
import SpellsPanel from './components/SpellsPanel.vue'

const activeSection = ref('quick-reference')
</script>

<template>
  <v-container fluid>
    <h2 class="text-h5 mb-3">Compendium</h2>

    <v-tabs v-model="activeSection" class="mb-4" show-arrows>
      <v-tab text="Quick Reference" value="quick-reference" />
      <v-tab text="Attributes & Skills" value="attributes-skills" />
      <v-tab text="Lifepath" value="lifepath" />
      <v-tab text="Advancement" value="advancement" />
      <v-tab text="Playing the Game" value="playing-the-game" />
      <v-tab text="Combat" value="combat" />
      <v-tab text="Mass Combat" value="mass-combat" />
      <v-tab text="Equipment" value="equipment" />
      <v-tab text="Talents" value="talents" />
      <v-tab text="Magick" value="magick" />
      <v-tab text="Spells" value="spells" />
    </v-tabs>

    <v-window v-model="activeSection">
      <v-window-item value="quick-reference"><QuickReferencePanel /></v-window-item>
      <v-window-item value="attributes-skills"><AttributesSkillsPanel /></v-window-item>
      <v-window-item value="lifepath"><LifepathPanel /></v-window-item>
      <v-window-item value="advancement"><AdvancementPanel /></v-window-item>
      <v-window-item value="playing-the-game">
        <RulesDocumentPanel :document="CoreContent.rules.playingTheGame" />
      </v-window-item>
      <v-window-item value="combat"><RulesDocumentPanel :document="CoreContent.rules.combat" /></v-window-item>
      <v-window-item value="mass-combat">
        <RulesDocumentPanel :document="CoreContent.rules.massCombat" />
      </v-window-item>
      <v-window-item value="equipment"><EquipmentPanel /></v-window-item>
      <v-window-item value="talents"><TalentsPanel /></v-window-item>
      <v-window-item value="magick"><RulesDocumentPanel :document="CoreContent.rules.magick" /></v-window-item>
      <v-window-item value="spells"><SpellsPanel /></v-window-item>
    </v-window>
  </v-container>
</template>
