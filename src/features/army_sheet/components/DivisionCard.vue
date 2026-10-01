<script setup lang="ts">
/** One division on the live army sheet: Morale, Broken/Regroup, stratagem uses, Free Move. */
import { computed, ref } from 'vue'
import type { IArmyDivision } from '@/classes/Army'
import { CoreContent } from '@/io/ContentLoader'
import { useArmyStore } from '../store/ArmyStore'
import { attackLabel } from './armyLabels'
import SegmentedBar from '@/ui/SegmentedBar.vue'

/** Morale bar colour - green, like the character sheet's HP bar is red. */
const MORALE_BAR_COLOR = '#2e7d32'

const props = defineProps<{ div: IArmyDivision; maxMorale: number; bonusCD: number }>()
const store = useArmyStore()

const division = computed(() => CoreContent.armies.divisions.find((d) => d.id === props.div.divisionId)!)
const stratagem = computed(() => CoreContent.armies.stratagems.find((s) => s.id === props.div.stratagemId))

const amount = ref<number | null>(null)
const ignoreResistance = ref(false)
const showRules = ref(false)

function value(): number | null {
  const n = Math.round(Number(amount.value))
  return amount.value === null || Number.isNaN(n) || n <= 0 ? null : n
}
async function damage() {
  const n = value()
  if (n === null) return
  await store.damage(props.div.id, n, ignoreResistance.value)
  amount.value = null
}
async function restore() {
  const n = value()
  if (n === null) return
  await store.restore(props.div.id, n)
  amount.value = null
}
async function regroup() {
  const n = value()
  if (n === null) return
  await store.regroup(props.div.id, n)
  amount.value = null
}

/** Clicking a segment sets Morale to it - on a Broken division that counts as Regrouping it
 * back to that Morale. */
function pickMorale(value: number) {
  if (props.div.broken) store.patchDivision(props.div.id, { broken: false, morale: value })
  else store.setMorale(props.div.id, value)
}

function toggleUse(i: number) {
  const spent = props.div.stratagemUsesSpent
  store.patchDivision(props.div.id, { stratagemUsesSpent: i < spent ? i : i + 1 })
}
</script>

<template>
  <v-card variant="outlined" :class="['h-100 division-card', { 'not-deployed': !div.deployed, broken: div.broken }]">
    <v-card-title class="d-flex flex-wrap align-center ga-2 pb-1">
      <span>{{ div.nickname || division.name }}</span>
      <v-chip v-if="div.broken" color="error" size="small" variant="flat">Broken</v-chip>
      <v-spacer />
      <v-switch
        :model-value="div.deployed"
        label="Deployed"
        color="primary"
        density="compact"
        hide-details
        @update:model-value="(v) => store.patchDivision(div.id, { deployed: !!v })"
      />
    </v-card-title>
    <v-card-subtitle class="text-wrap">
      <template v-if="div.nickname">{{ division.name }} · </template>{{ division.types.join(', ') }}
    </v-card-subtitle>

    <v-card-text>
      <div class="d-flex align-end ga-2 mb-1">
        <span class="text-h4 font-weight-bold" :class="{ 'text-error': div.broken }">{{ div.morale }}</span>
        <span class="text-body-1 text-medium-emphasis mb-1">/ {{ maxMorale }} Morale</span>
      </div>
      <SegmentedBar
        :filled="div.morale"
        :total="Math.max(maxMorale, div.morale)"
        :color="MORALE_BAR_COLOR"
        interactive
        :range-start="0"
        :current-value="div.morale"
        class="mb-3"
        @pick="pickMorale"
      />

      <div class="d-flex flex-wrap align-center ga-2 mb-1">
        <v-text-field
          v-model.number="amount"
          type="number"
          min="1"
          label="Amount"
          density="compact"
          hide-details
          style="max-width: 100px"
          @keydown.enter="damage"
        />
        <v-btn size="small" color="error" variant="tonal" :disabled="!amount" @click="damage">Damage</v-btn>
        <v-btn v-if="!div.broken" size="small" color="success" variant="tonal" :disabled="!amount" @click="restore">Restore</v-btn>
        <v-btn v-else size="small" color="primary" variant="flat" :disabled="!amount" @click="regroup">Regroup</v-btn>
      </div>
      <v-checkbox
        v-model="ignoreResistance"
        density="compact"
        hide-details
        :label="`Ignore Resistance (${division.resistance}) - e.g. an officer defeat`"
        class="mb-2"
      />
      <p v-if="div.broken" class="text-caption text-error mb-2">
        Broken: no buff or passive effects, can't move or take orders other than Regroup. Regroup restores 2 + the
        officer's Authority [CD].
      </p>

      <div class="d-flex flex-wrap ga-4 text-body-2 mb-2">
        <div><strong>Resistance</strong> {{ division.resistance }}</div>
        <div>
          <strong>{{ division.attack.ranged ? 'Ranged Attack' : 'Attack' }}</strong>
          {{ attackLabel(division, bonusCD) }}
          <span v-if="bonusCD" class="text-caption text-medium-emphasis">(+{{ bonusCD }} Scale bonus)</span>
        </div>
      </div>

      <p class="text-body-2 mb-2" :class="{ 'text-disabled': div.broken }">
        <strong>Buff:</strong>&nbsp;<template v-if="division.buff"><strong>{{ division.buff.name }}</strong> - {{ division.buff.text }}</template><template v-else>None</template>
      </p>

      <div v-if="stratagem" class="stratagem mb-2">
        <div class="d-flex flex-wrap align-center ga-2">
          <strong class="text-body-2">{{ stratagem.name }}</strong>
          <v-chip size="x-small" variant="tonal">{{ stratagem.kind === 'order' ? 'Order' : 'Passive' }}</v-chip>
          <v-spacer />
          <template v-if="stratagem.usesPerScene">
            <span class="text-caption text-medium-emphasis">Uses</span>
            <v-btn
              v-for="i in stratagem.usesPerScene"
              :key="i"
              :icon="i - 1 < div.stratagemUsesSpent ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
              size="x-small"
              variant="text"
              density="comfortable"
              :aria-label="`Stratagem use ${i}`"
              @click="toggleUse(i - 1)"
            />
          </template>
        </div>
        <p class="text-body-2 mb-0" :class="{ 'text-disabled': div.broken }" style="white-space: pre-line">{{ stratagem.text }}</p>
      </div>

      <div class="d-flex flex-wrap ga-2">
        <v-chip
          size="small"
          :variant="div.freeMoveUsed ? 'flat' : 'outlined'"
          :prepend-icon="div.freeMoveUsed ? 'mdi-check' : 'mdi-run-fast'"
          @click="store.patchDivision(div.id, { freeMoveUsed: !div.freeMoveUsed })"
        >
          {{ div.freeMoveUsed ? 'Free Move used' : 'Free Move available' }}
        </v-chip>
        <v-chip
          v-if="div.stratagemId === 'mounted_infantry'"
          size="small"
          :variant="div.mounted ? 'flat' : 'outlined'"
          prepend-icon="mdi-horse"
          @click="store.patchDivision(div.id, { mounted: !div.mounted })"
        >
          {{ div.mounted ? 'Mounted' : 'Dismounted' }}
        </v-chip>
      </div>

      <v-btn size="small" variant="text" class="mt-2 px-0" :append-icon="showRules ? 'mdi-chevron-up' : 'mdi-chevron-down'" @click="showRules = !showRules">
        Features
      </v-btn>
      <v-expand-transition>
        <ul v-if="showRules" class="pl-5 text-body-2">
          <li v-for="(f, i) in division.features" :key="i" class="mb-1">{{ f }}</li>
        </ul>
      </v-expand-transition>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.not-deployed {
  opacity: 0.6;
}
.broken {
  border-color: rgb(var(--v-theme-error)) !important;
}
.stratagem {
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
