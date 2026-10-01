<script setup lang="ts">
/** The live army sheet: army overview, one card per division, Talents, and notes. */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { armyTraits, scaleBonus, startingMorale } from '@/classes/Army'
import { CoreContent } from '@/io/ContentLoader'
import NotesEditor from '@/ui/NotesEditor.vue'
import { exportArmyToFile } from '@/io/ArmyTransfer'
import { downloadArmyStatblock } from '@/io/ArmyStatblockExport'
import { useArmyStore } from './store/ArmyStore'
import DivisionCard from './components/DivisionCard.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()
const store = useArmyStore()
const { rules, talents, divisions } = CoreContent.armies

watch(() => props.id, (id) => store.open(id), { immediate: true })

const army = computed(() => store.army)
const bonus = computed(() => (army.value ? scaleBonus(army.value) : 0))
const maxMorale = computed(() => (army.value ? startingMorale(army.value, rules) : rules.baseMorale))
const traits = computed(() => (army.value ? armyTraits(army.value, divisions) : []))
const armyTalents = computed(() => talents.filter((t) => army.value?.talentIds.includes(t.id)))
const deployedCount = computed(() => army.value?.divisions.filter((d) => d.deployed).length ?? 0)
const brokenCount = computed(() => army.value?.divisions.filter((d) => d.broken).length ?? 0)

const confirming = ref<'battle' | 'delete' | null>(null)
async function newBattle() {
  await store.newBattle()
  confirming.value = null
}
async function remove() {
  if (!army.value) return
  await store.remove(army.value.id)
  router.push('/armies')
}
</script>

<template>
  <v-container fluid>
    <p v-if="store.notFound" class="text-medium-emphasis">
      This army doesn't exist. <router-link to="/armies">Back to armies</router-link>
    </p>

    <template v-else-if="army && army.id === id">
      <div class="d-flex align-center flex-wrap ga-2 mb-3">
        <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/armies">Armies</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="exportArmyToFile(army)">Export</v-btn>
        <v-btn variant="text" @click="downloadArmyStatblock(army)">Generate Statblock</v-btn>
        <v-btn variant="tonal" prepend-icon="mdi-pencil" :to="`/armies/${army.id}/edit`">Edit Army</v-btn>
      </div>

      <v-card variant="outlined" class="mb-4">
        <v-card-title class="text-h5 text-wrap">{{ army.name }}</v-card-title>
        <v-card-subtitle class="text-wrap">Scale {{ army.scale }} · Party level {{ army.partyLevel }}</v-card-subtitle>
        <v-card-text>
          <div class="text-overline text-medium-emphasis">Traits</div>
          <div class="d-flex flex-wrap ga-2 mb-3">
            <v-chip v-for="t in traits" :key="t" size="small" :variant="t === army.definingFeature ? 'flat' : 'tonal'" :color="t === army.definingFeature ? 'primary' : undefined">
              {{ t }}
            </v-chip>
          </div>

          <div class="text-overline text-medium-emphasis">Battle</div>
          <div class="d-flex flex-wrap align-center ga-2">
            <v-chip size="small" variant="tonal">Deployed {{ deployedCount }} / {{ army.scale }}</v-chip>
            <v-chip size="small" variant="tonal" :color="bonus ? 'primary' : undefined">
              Scale bonus: {{ bonus ? `+${bonus} Morale, +${bonus}[CD] vs divisions` : 'none' }}
            </v-chip>
            <v-chip v-if="brokenCount" size="small" color="error" variant="tonal">{{ brokenCount }} Broken</v-chip>
            <v-spacer />
            <v-btn size="small" variant="tonal" prepend-icon="mdi-refresh" @click="store.endRound()">End Round</v-btn>
            <template v-if="confirming === 'battle'">
              <span class="text-body-2">Reset every division to {{ maxMorale }} Morale and clear stratagem uses?</span>
              <v-btn size="small" variant="text" @click="confirming = null">Cancel</v-btn>
              <v-btn size="small" color="primary" variant="flat" @click="newBattle">New Battle</v-btn>
            </template>
            <v-btn v-else size="small" color="primary" variant="tonal" prepend-icon="mdi-sword-cross" @click="confirming = 'battle'">
              New Battle
            </v-btn>
          </div>
          <p class="text-caption text-medium-emphasis mt-2 mb-0">
            Bringing fewer divisions than your Scale gives every division +1 Morale and +1[CD] on attacks against
            divisions per point of Scale above the number brought. Set who's deployed, then press New Battle.
            End Round makes every Free Move available again.
          </p>
        </v-card-text>
      </v-card>

      <v-row>
        <v-col v-for="d in army.divisions" :key="d.id" cols="12" md="6" xl="4">
          <DivisionCard :div="d" :max-morale="maxMorale" :bonus-c-d="d.deployed ? bonus : 0" />
        </v-col>
      </v-row>

      <v-row class="mt-2">
        <v-col cols="12" md="7">
          <v-card variant="outlined" class="h-100">
            <v-card-title class="text-subtitle-1">Army Talents</v-card-title>
            <v-card-text>
              <div v-for="t in armyTalents" :key="t.id" class="mb-3 text-body-2">
                <strong>{{ t.name }}</strong>
                <p class="mb-0" style="white-space: pre-line">{{ t.text }}</p>
              </div>
              <p v-if="!armyTalents.length" class="text-body-2 text-medium-emphasis">No Talents chosen.</p>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="5">
          <v-card variant="outlined" class="h-100">
            <v-card-title class="text-subtitle-1">Notes</v-card-title>
            <v-card-text>
              <NotesEditor :key="army.id" :model-value="army.notes" @change="store.setNotes" />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <div class="d-flex justify-end mt-4">
        <template v-if="confirming === 'delete'">
          <span class="text-body-2 mr-2 align-self-center">Delete {{ army.name }}?</span>
          <v-btn size="small" variant="text" @click="confirming = null">Cancel</v-btn>
          <v-btn size="small" color="error" variant="flat" @click="remove">Delete</v-btn>
        </template>
        <v-btn v-else size="small" variant="text" color="error" prepend-icon="mdi-delete" @click="confirming = 'delete'">
          Delete Army
        </v-btn>
      </div>
    </template>
  </v-container>
</template>
