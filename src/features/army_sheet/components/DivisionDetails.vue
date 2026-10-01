<script setup lang="ts">
/** A division's rules card: types, Resistance, attack, buff, features, and its stratagem options. */
import { computed } from 'vue'
import type { IDivisionData } from '@/classes/Army'
import { stratagemsFor } from '@/classes/Army'
import { CoreContent } from '@/io/ContentLoader'
import { attackLabel } from './armyLabels'

const props = defineProps<{ division: IDivisionData }>()
defineSlots<{ actions(): unknown }>()

const options = computed(() => stratagemsFor(props.division, CoreContent.armies.stratagems))
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="d-flex flex-wrap align-center ga-2">
      <span>{{ division.name }}</span>
      <v-chip v-for="t in division.types" :key="t" size="small" variant="tonal">{{ t }}</v-chip>
    </v-card-title>
    <v-card-subtitle class="text-wrap font-italic">{{ division.description }}</v-card-subtitle>
    <v-card-text class="text-body-2">
      <div class="d-flex flex-wrap ga-4 mb-3">
        <div><strong>Resistance</strong> {{ division.resistance }}</div>
        <div><strong>{{ division.attack.ranged ? 'Ranged Attack Damage' : 'Attack Damage' }}</strong> {{ attackLabel(division) }}</div>
      </div>
      <p class="mb-2"><strong>Buff:</strong> <template v-if="division.buff"><strong>{{ division.buff.name }}</strong> - {{ division.buff.text }}</template><template v-else>None</template></p>
      <div class="text-overline text-medium-emphasis">Features</div>
      <ul class="pl-5 mb-3">
        <li v-for="(f, i) in division.features" :key="i" class="mb-1">{{ f }}</li>
      </ul>
      <div class="text-overline text-medium-emphasis">Stratagem options ({{ options.length }})</div>
      <div class="d-flex flex-wrap ga-1 mb-2">
        <v-tooltip v-for="s in options" :key="s.id" :text="s.text" location="top" max-width="380">
          <template #activator="{ props: activatorProps }">
            <v-chip v-bind="activatorProps" size="small" variant="outlined">
              {{ s.name }}<span class="text-medium-emphasis ml-1">({{ s.kind === 'order' ? 'Order' : 'Passive' }})</span>
            </v-chip>
          </template>
        </v-tooltip>
      </div>
      <slot name="actions" />
    </v-card-text>
  </v-card>
</template>
