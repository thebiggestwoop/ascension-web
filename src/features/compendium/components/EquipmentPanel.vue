<script setup lang="ts">
import { ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import type { IQualityInstance } from '@/classes/Equipment'

const activeTab = ref('weapons')

function qualityText(q: IQualityInstance): string {
  const label = q.quality
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
  return q.value !== undefined ? `${label} ${q.value}` : label
}
</script>

<template>
  <div>
    <v-tabs v-model="activeTab" class="mb-3">
      <v-tab text="Weapons" value="weapons" />
      <v-tab text="Armor" value="armor" />
      <v-tab text="Shields" value="shields" />
      <v-tab text="Mounts" value="mounts" />
      <v-tab text="General" value="general" />
    </v-tabs>

    <v-row v-if="activeTab === 'weapons'">
      <v-col v-for="w in CoreContent.equipment.weapons" :key="w.id" cols="12" sm="6" md="4">
        <v-card variant="outlined" class="h-100">
          <v-card-title>{{ w.name }}</v-card-title>
          <v-card-subtitle>{{ w.tag }} - {{ w.hands }}-handed{{ w.range ? ` - Range ${w.range}` : '' }}</v-card-subtitle>
          <v-card-text>
            <div class="mb-1">{{ w.damageCD }}[CD]{{ w.damageEffects.length ? ` (${w.damageEffects.join(', ')})` : '' }}</div>
            <v-chip v-for="(q, i) in w.qualities" :key="i" size="small" class="mr-1 mb-1">{{ qualityText(q) }}</v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else-if="activeTab === 'armor'">
      <v-col v-for="a in CoreContent.equipment.armor" :key="a.id" cols="12" sm="6" md="4">
        <v-card variant="outlined" class="h-100">
          <v-card-title>{{ a.name }}</v-card-title>
          <v-card-subtitle>Resistance {{ a.resistance }}</v-card-subtitle>
          <v-card-text>
            <v-chip v-for="(q, i) in a.qualities" :key="i" size="small" class="mr-1 mb-1">{{ qualityText(q) }}</v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else-if="activeTab === 'shields'">
      <v-col v-for="s in CoreContent.equipment.shields" :key="s.id" cols="12" sm="6" md="4">
        <v-card variant="outlined" class="h-100">
          <v-card-title>{{ s.name }}</v-card-title>
          <v-card-subtitle>Resistance {{ s.resistance }}{{ s.hands ? ` - ${s.hands}-handed` : '' }}</v-card-subtitle>
          <v-card-text>
            <v-chip v-for="(q, i) in s.qualities" :key="i" size="small" class="mr-1 mb-1">{{ qualityText(q) }}</v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else-if="activeTab === 'mounts'">
      <v-col v-for="m in CoreContent.equipment.mounts" :key="m.id" cols="12" sm="6" md="4">
        <v-card variant="outlined" class="h-100">
          <v-card-title>{{ m.name }}</v-card-title>
          <v-card-subtitle>
            Speed {{ m.baseSpeed }}{{ m.canFly ? ' (Flying)' : '' }}{{ m.groundImmobile ? ' - immobile on ground' : '' }}
          </v-card-subtitle>
          <v-card-text>
            <p>{{ m.description }}</p>
            <p v-if="m.specialRules" class="text-caption text-medium-emphasis">{{ m.specialRules }}</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col v-for="g in CoreContent.equipment.general" :key="g.id" cols="12" sm="6" md="4">
        <v-card variant="outlined" class="h-100">
          <v-card-title>{{ g.name }}</v-card-title>
          <v-card-subtitle v-if="g.hands">{{ g.hands }}-handed</v-card-subtitle>
          <v-card-text>
            <p>{{ g.description }}</p>
            <v-chip v-for="(q, i) in g.qualities" :key="i" size="small" class="mr-1 mb-1">{{ qualityText(q) }}</v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
