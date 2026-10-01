<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EncounterAlliance, EncounterDeployment, IEncounterData } from '@/classes/Encounter'
import { ALLIANCE_LABEL, DEPLOYMENT_LABEL } from '@/classes/Encounter'
import { resolveCustomNpc } from '@/classes/CustomNpc'
import { CoreContent } from '@/io/ContentLoader'
import { useEncounterStore } from '../store/EncounterStore'
import { useNpcBuilderStore } from '../store/NpcBuilderStore'
import NpcStatBlock from './NpcStatBlock.vue'

const props = defineProps<{ encounter: IEncounterData }>()
const emit = defineEmits<{ openNpcBuilder: [] }>()
const store = useEncounterStore()
const npcStore = useNpcBuilderStore()

const allianceItems = (Object.keys(ALLIANCE_LABEL) as EncounterAlliance[]).map((v) => ({ title: ALLIANCE_LABEL[v], value: v }))
const deploymentItems = (Object.keys(DEPLOYMENT_LABEL) as EncounterDeployment[]).map((v) => ({
  title: DEPLOYMENT_LABEL[v],
  value: v,
}))
const ALLIANCE_COLOR: Record<EncounterAlliance, string> = { enemy: 'error', ally: 'success', neutral: 'grey' }

// --- name: required, edited locally and committed on blur ---
const nameDraft = ref(props.encounter.name)
const confirmingDelete = ref(false)
const expanded = ref<string[]>([])
watch(
  () => props.encounter.id,
  () => {
    nameDraft.value = props.encounter.name
    confirmingDelete.value = false
    expanded.value = []
  },
)
const nameError = computed(() => (nameDraft.value.trim() ? null : 'An encounter must have a name.'))
function commitName() {
  if (nameError.value) nameDraft.value = props.encounter.name
  else if (nameDraft.value.trim() !== props.encounter.name) store.rename(props.encounter.id, nameDraft.value)
}

// --- adding NPCs ---
const npcToAdd = ref<string | null>(null)
const addCount = ref(1)
const npcItems = computed(() =>
  npcStore.npcs.map((n) => {
    const base = CoreContent.npcs.classes.find((c) => c.id === n.baseNpcId)
    return {
      title: n.name,
      value: n.id,
      subtitle: [base?.name, `Tier ${n.tier}`, ...n.customTags].filter(Boolean).join(' · '),
    }
  }),
)
async function addNpc() {
  if (!npcToAdd.value) return
  await store.addNpc(props.encounter.id, npcToAdd.value, Math.max(1, Math.min(20, Math.round(addCount.value) || 1)))
  npcToAdd.value = null
  addCount.value = 1
}

// --- entries ---
const rows = computed(() =>
  props.encounter.entries.map((entry) => {
    const npc = npcStore.npcs.find((n) => n.id === entry.npcId)
    const base = npc && CoreContent.npcs.classes.find((c) => c.id === npc.baseNpcId)
    return {
      entry,
      npc,
      base,
      resolved: npc && base ? resolveCustomNpc(npc, base, CoreContent.npcs.templates.templates) : null,
      color: CoreContent.npcs.types.find((t) => t.name === base?.colorType)?.color,
    }
  }),
)

const summary = computed(() => {
  const count = (pred: (r: (typeof rows.value)[number]) => boolean) => rows.value.filter(pred).length
  return [
    { label: 'Enemies', value: count((r) => r.entry.alliance === 'enemy'), color: 'error' },
    { label: 'Allies', value: count((r) => r.entry.alliance === 'ally'), color: 'success' },
    { label: 'Neutral', value: count((r) => r.entry.alliance === 'neutral'), color: 'grey' },
    { label: 'Reinforcements', value: count((r) => r.entry.deployment === 'reinforcement'), color: undefined },
  ]
})

function setRound(entryId: string, raw: string | number) {
  const n = Math.round(Number(raw))
  store.setDeploysOnRound(props.encounter.id, entryId, raw === '' || Number.isNaN(n) || n < 1 ? null : Math.min(n, 99))
}

function toggleExpanded(entryId: string) {
  expanded.value = expanded.value.includes(entryId)
    ? expanded.value.filter((id) => id !== entryId)
    : [...expanded.value, entryId]
}
</script>

<template>
  <div>
    <v-card variant="outlined" class="mb-4">
      <v-card-text>
        <div class="d-flex flex-wrap align-start ga-3">
          <v-text-field
            v-model="nameDraft"
            label="Encounter name"
            density="compact"
            :error-messages="nameError ?? undefined"
            class="flex-grow-1"
            style="min-width: 220px"
            @blur="commitName"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />
          <v-btn variant="tonal" prepend-icon="mdi-download" class="mt-1" @click="store.exportToFile(encounter.id)">
            Export
          </v-btn>
        </div>
        <div class="d-flex flex-wrap align-center ga-2">
          <v-chip v-for="s in summary" :key="s.label" size="small" :color="s.color" variant="tonal">
            {{ s.label }}: {{ s.value }}
          </v-chip>
          <v-spacer />
          <template v-if="confirmingDelete">
            <span class="text-body-2">Delete {{ encounter.name }}? Its NPCs stay in the NPC Builder.</span>
            <v-btn size="small" variant="text" @click="confirmingDelete = false">Cancel</v-btn>
            <v-btn size="small" color="error" variant="flat" @click="store.remove(encounter.id)">Delete</v-btn>
          </template>
          <v-btn v-else size="small" variant="text" color="error" prepend-icon="mdi-delete" @click="confirmingDelete = true">
            Delete
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card variant="outlined" class="mb-4">
      <v-card-title class="text-subtitle-1">Add NPCs</v-card-title>
      <v-card-text>
        <p v-if="!npcStore.npcs.length" class="text-body-2 text-medium-emphasis">
          You haven't created any NPCs yet.
          <a href="#" @click.prevent="emit('openNpcBuilder')">Build some in the NPC Builder</a>, then add them here.
        </p>
        <div v-else class="d-flex flex-wrap align-start ga-3">
          <v-autocomplete
            v-model="npcToAdd"
            :items="npcItems"
            label="NPC"
            density="compact"
            class="flex-grow-1"
            style="min-width: 220px"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps" :subtitle="item.raw.subtitle" />
            </template>
          </v-autocomplete>
          <v-text-field
            v-model.number="addCount"
            label="How many"
            type="number"
            min="1"
            max="20"
            density="compact"
            style="max-width: 110px"
          />
          <v-btn color="primary" variant="flat" class="mt-1" :disabled="!npcToAdd" @click="addNpc">Add</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <p v-if="!rows.length" class="text-body-2 text-medium-emphasis">No NPCs in this encounter yet.</p>

    <v-card v-for="row in rows" :key="row.entry.id" variant="outlined" class="mb-2">
      <v-card-text class="d-flex flex-wrap align-center ga-3 py-3">
        <div class="d-flex align-center ga-2 entry-name">
          <span class="type-dot" :style="{ backgroundColor: row.color ?? 'transparent' }" />
          <div>
            <div class="text-body-1">
              <template v-if="row.npc">{{ row.npc.name }}</template>
              <span v-else class="text-error">Deleted NPC</span>
            </div>
            <div class="text-caption text-medium-emphasis">
              <template v-if="row.npc && row.base">{{ row.base.name }} · Tier {{ row.npc.tier }}</template>
              <template v-else>This NPC was deleted from the NPC Builder.</template>
            </div>
          </div>
        </div>
        <v-select
          :model-value="row.entry.alliance"
          :items="allianceItems"
          label="Alliance"
          density="compact"
          hide-details
          :base-color="ALLIANCE_COLOR[row.entry.alliance]"
          :color="ALLIANCE_COLOR[row.entry.alliance]"
          style="max-width: 140px"
          @update:model-value="(v) => store.setAlliance(encounter.id, row.entry.id, v)"
        />
        <v-select
          :model-value="row.entry.deployment"
          :items="deploymentItems"
          label="Deployment"
          density="compact"
          hide-details
          style="max-width: 170px"
          @update:model-value="(v) => store.setDeployment(encounter.id, row.entry.id, v)"
        />
        <v-text-field
          v-if="row.entry.deployment === 'reinforcement'"
          :model-value="row.entry.deploysOnRound ?? ''"
          label="Deploys on Round"
          placeholder="Optional"
          persistent-placeholder
          type="number"
          min="1"
          density="compact"
          hide-details
          style="max-width: 150px"
          @update:model-value="(v) => setRound(row.entry.id, v)"
        />
        <v-spacer />
        <v-btn
          v-if="row.resolved"
          size="small"
          variant="text"
          :prepend-icon="expanded.includes(row.entry.id) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          @click="toggleExpanded(row.entry.id)"
        >
          Stat block
        </v-btn>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          :aria-label="`Remove ${row.npc?.name ?? 'NPC'} from encounter`"
          @click="store.removeEntry(encounter.id, row.entry.id)"
        />
      </v-card-text>
      <v-expand-transition>
        <div v-if="row.resolved && row.npc && expanded.includes(row.entry.id)" class="px-4 pb-4">
          <NpcStatBlock
            :npc="row.resolved"
            :tier="row.npc.tier"
            :based-on="`${row.base?.name} · Tier ${row.npc.tier}`"
            :custom-tags="row.npc.customTags"
          />
        </div>
      </v-expand-transition>
    </v-card>
  </div>
</template>

<style scoped>
.entry-name {
  min-width: 200px;
  flex: 1 1 200px;
}
.type-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(128, 128, 128, 0.6);
  flex-shrink: 0;
}
</style>
