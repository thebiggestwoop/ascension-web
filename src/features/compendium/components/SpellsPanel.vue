<script setup lang="ts">
import { computed, ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import type { ISpellData, MagickDomain } from '@/classes/Spell'

const activeDomain = ref<MagickDomain>('arcane')
const searchText = ref('')

const domainSpells: Record<MagickDomain, ISpellData[]> = {
  arcane: CoreContent.spells.arcane,
  light: CoreContent.spells.light,
  dark: CoreContent.spells.dark,
}

const selectedSpellId = ref<string | null>(null)

const filteredSpells = computed(() => {
  const list = domainSpells[activeDomain.value]
  const q = searchText.value.trim().toLowerCase()
  return q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list
})

const selectedSpell = computed(() => domainSpells[activeDomain.value].find((s) => s.id === selectedSpellId.value))

function selectDomain(domain: MagickDomain) {
  activeDomain.value = domain
  selectedSpellId.value = null
}

function actionLabel(action: ISpellData['action']): string {
  return action[0].toUpperCase() + action.slice(1)
}
</script>

<template>
  <div>
    <v-tabs :model-value="activeDomain" class="mb-3" @update:model-value="(v) => selectDomain(v as MagickDomain)">
      <v-tab :text="`Arcane (${CoreContent.spells.arcane.length})`" value="arcane" />
      <v-tab :text="`Light (${CoreContent.spells.light.length})`" value="light" />
      <v-tab :text="`Dark (${CoreContent.spells.dark.length})`" value="dark" />
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
        <v-list density="compact" style="max-height: 70vh; overflow-y: auto">
          <v-list-item
            v-for="s in filteredSpells"
            :key="s.id"
            :title="s.name"
            :subtitle="`Tier ${s.tier} - ${s.tags.join(', ')}`"
            :active="selectedSpellId === s.id"
            color="primary"
            @click="selectedSpellId = s.id"
          />
        </v-list>
      </v-col>

      <v-col cols="12" md="8">
        <v-card v-if="selectedSpell" variant="outlined">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>{{ selectedSpell.name }}</span>
            <v-chip size="small">Tier {{ selectedSpell.tier }}</v-chip>
          </v-card-title>
          <v-card-subtitle>
            {{ selectedSpell.tags.join(', ') }} - {{ selectedSpell.slotCost }} Spell Slot{{ selectedSpell.slotCost > 1 ? 's' : '' }}
            - {{ actionLabel(selectedSpell.action) }}
            - {{ selectedSpell.usesPerScene === 'passive' ? 'Passive' : `${selectedSpell.usesPerScene}/Scene` }}
            <span v-if="selectedSpell.willpowerCost"> - {{ selectedSpell.willpowerCost }} Willpower</span>
            <span v-if="selectedSpell.range"> - Range {{ selectedSpell.range }}</span>
          </v-card-subtitle>
          <v-card-text>{{ selectedSpell.effectText }}</v-card-text>
        </v-card>
        <p v-else class="text-medium-emphasis">Select a spell on the left.</p>
      </v-col>
    </v-row>
  </div>
</template>
