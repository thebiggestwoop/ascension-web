<script setup lang="ts">
/** Builder Step Two: recruit up to Scale divisions, each with one stratagem. */
import { computed, ref } from 'vue'
import type { IArmyData, IDivisionData } from '@/classes/Army'
import { newArmyDivision, startingMorale, stratagemsFor } from '@/classes/Army'
import { CoreContent } from '@/io/ContentLoader'
import DivisionDetails from './DivisionDetails.vue'

const army = defineModel<IArmyData>({ required: true })
const { divisions, stratagems, rules } = CoreContent.armies

const browsingId = ref<string>(divisions[0].id)
const browsing = computed(() => divisions.find((d) => d.id === browsingId.value)!)
const full = computed(() => army.value.divisions.length >= army.value.scale)

function divisionOf(id: string): IDivisionData {
  return divisions.find((d) => d.id === id)!
}

function recruit(d: IDivisionData) {
  if (full.value) return
  const options = stratagemsFor(d, stratagems)
  army.value.divisions.push(newArmyDivision(d, options.length === 1 ? options[0].id : null, startingMorale(army.value, rules)))
}

function remove(id: string) {
  army.value.divisions = army.value.divisions.filter((d) => d.id !== id)
}

function stratagemItems(divisionId: string) {
  return stratagemsFor(divisionOf(divisionId), stratagems).map((s) => ({
    title: s.name,
    value: s.id,
    subtitle: `${s.kind === 'order' ? 'Order' : 'Passive'}${s.usesPerScene ? ` · ${s.usesPerScene}/scene` : ''}`,
  }))
}

function stratagem(id: string | null) {
  return stratagems.find((s) => s.id === id)
}
</script>

<template>
  <div>
    <v-alert :type="full ? 'success' : 'info'" variant="tonal" density="compact" class="mb-4 text-body-2">
      {{ army.divisions.length }} of {{ army.scale }} divisions recruited. An army can have up to a number of
      divisions equal to its Scale. Each division gets 1 stratagem.
    </v-alert>

    <div class="text-overline text-medium-emphasis">Your divisions</div>
    <p v-if="!army.divisions.length" class="text-body-2 text-medium-emphasis mb-4">None yet. Recruit from the list below.</p>
    <v-card v-for="(d, i) in army.divisions" :key="d.id" variant="outlined" class="mb-2">
      <v-card-text class="d-flex flex-wrap align-start ga-3">
        <div style="min-width: 180px; flex: 1 1 180px">
          <div class="text-body-1">{{ i + 1 }}. {{ divisionOf(d.divisionId).name }}</div>
          <div class="text-caption text-medium-emphasis">{{ divisionOf(d.divisionId).types.join(', ') }}</div>
        </div>
        <v-text-field
          v-model="d.nickname"
          label="Nickname (optional)"
          density="compact"
          hide-details
          style="min-width: 160px; flex: 1 1 160px"
        />
        <v-select
          v-model="d.stratagemId"
          :items="stratagemItems(d.divisionId)"
          label="Stratagem"
          density="compact"
          :error-messages="d.stratagemId ? undefined : 'Choose a stratagem'"
          style="min-width: 220px; flex: 2 1 220px"
          @update:model-value="d.mounted = d.stratagemId === 'mounted_infantry'"
        >
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :subtitle="item.raw.subtitle" />
          </template>
        </v-select>
        <v-btn icon="mdi-close" variant="text" size="small" :aria-label="`Remove ${divisionOf(d.divisionId).name}`" @click="remove(d.id)" />
      </v-card-text>
      <v-card-text v-if="stratagem(d.stratagemId)" class="pt-0 text-body-2 text-medium-emphasis" style="white-space: pre-line">
        {{ stratagem(d.stratagemId)!.text }}
      </v-card-text>
    </v-card>

    <div class="text-overline text-medium-emphasis mt-4">Available divisions</div>
    <v-row>
      <v-col cols="12" md="4">
        <v-list density="compact" style="max-height: 60vh; overflow-y: auto">
          <v-list-item
            v-for="d in divisions"
            :key="d.id"
            :title="d.name"
            :subtitle="d.types.join(', ')"
            :active="browsingId === d.id"
            color="primary"
            @click="browsingId = d.id"
          />
        </v-list>
      </v-col>
      <v-col cols="12" md="8">
        <DivisionDetails :division="browsing">
          <template #actions>
            <v-btn color="primary" variant="flat" :disabled="full" prepend-icon="mdi-plus" @click="recruit(browsing)">
              Recruit {{ browsing.name }}
            </v-btn>
            <span v-if="full" class="text-caption text-medium-emphasis ml-2">Your army is at its Scale limit.</span>
          </template>
        </DivisionDetails>
      </v-col>
    </v-row>
  </div>
</template>
