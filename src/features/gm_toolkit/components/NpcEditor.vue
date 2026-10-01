<script setup lang="ts">
/** Edits one NPC Builder NPC, with its finished stat block previewed alongside. */
import { computed, onMounted, ref, watch } from 'vue'
import type { ICustomNpcData, NpcBodyPart } from '@/classes/CustomNpc'
import { optionalFeatureKey, resolveCustomNpc } from '@/classes/CustomNpc'
import type { NpcTier } from '@/classes/Npc'
import { resolveTierText } from '@/classes/Npc'
import { AttributeId, SkillId } from '@/classes/enums'
import { CoreContent } from '@/io/ContentLoader'
import NotesEditor from '@/ui/NotesEditor.vue'
import { useNpcBuilderStore } from '../store/NpcBuilderStore'
import { useEncounterStore } from '../store/EncounterStore'
import NpcStatBlock from './NpcStatBlock.vue'
import NpcTypeChip from './NpcTypeChip.vue'
import NpcTagEditor from './NpcTagEditor.vue'

const props = defineProps<{ npc: ICustomNpcData }>()
const store = useNpcBuilderStore()

const ATTRIBUTES = Object.values(AttributeId)
const SKILLS = Object.values(SkillId)
const PARTS: NpcBodyPart[] = ['head', 'torso', 'legs']

/** Templates for regular combat - the Commander is mass combat only. */
const templates = CoreContent.npcs.templates.templates.filter((t) => !t.massCombatOnly)

const base = computed(() => CoreContent.npcs.classes.find((n) => n.id === props.npc.baseNpcId)!)
const resolved = computed(() => resolveCustomNpc(props.npc, base.value, CoreContent.npcs.templates.templates))
const template = computed(() => templates.find((t) => t.id === props.npc.templateId) ?? null)

function label(id: string): string {
  return id[0].toUpperCase() + id.slice(1)
}

// --- name: edited locally, committed on blur when valid ---
const nameDraft = ref(props.npc.name)
watch(
  () => props.npc.id,
  () => {
    nameDraft.value = props.npc.name
    confirmingDelete.value = false
  },
)
const nameError = computed(() => {
  if (!nameDraft.value.trim()) return 'Give the NPC a name.'
  if (store.isNameTaken(nameDraft.value, props.npc.id)) return 'Another NPC already has this name.'
  return null
})
function commitName() {
  if (nameError.value) {
    nameDraft.value = props.npc.name
    return
  }
  if (nameDraft.value.trim() !== props.npc.name) store.rename(props.npc.id, nameDraft.value)
}

const tierModel = computed({
  get: () => props.npc.tier,
  set: (t: NpcTier) => store.setTier(props.npc.id, t),
})

const templateModel = computed({
  get: () => props.npc.templateId,
  set: (id: string | null) => store.setTemplate(props.npc.id, id ?? null),
})

const optionalSections = computed(() =>
  (['optionalFeatures', 'optionalMajorFeatures'] as const)
    .map((section) => ({
      section,
      title: section === 'optionalFeatures' ? 'Optional Features' : 'Optional Major Features',
      entries: base.value[section] ?? [],
    }))
    .filter((s) => s.entries.length),
)

const chosenOptionalCount = computed(
  () => props.npc.optionalFeatureKeys.filter((k) => k.startsWith('optionalFeatures:')).length,
)
const chosenMajorCount = computed(
  () => props.npc.optionalFeatureKeys.filter((k) => k.startsWith('optionalMajorFeatures:')).length,
)

function entryHeading(name: string, tags?: string[]): string {
  return tags?.length ? `${name} (${tags.join(', ')})` : name
}

function numberInput(raw: string | number, min: number, max: number): number | null {
  const n = Math.round(Number(raw))
  if (raw === '' || Number.isNaN(n)) return null
  return Math.max(min, Math.min(max, n))
}

function setAttribute(a: AttributeId, raw: string | number, part?: NpcBodyPart) {
  const v = numberInput(raw, 1, 20)
  if (v !== null) store.setAttribute(props.npc.id, a, v, part)
}
function setSkill(s: SkillId, raw: string | number) {
  const v = numberInput(raw, 0, 5)
  if (v !== null) store.setSkill(props.npc.id, s, v)
}
function setResistance(raw: string | number) {
  const v = numberInput(raw, 0, 10)
  if (v !== null) store.setResistance(props.npc.id, v)
}

/** The class's own value at this tier, shown as a hint when an edited stat differs. */
function baseAttribute(a: AttributeId, part?: NpcBodyPart): number | undefined {
  const values = part ? base.value.parts?.[part].attributes[a] : base.value.attributes?.[a]
  return values?.[props.npc.tier - 1]
}

const confirmingDelete = ref(false)

const encounterStore = useEncounterStore()
onMounted(() => encounterStore.load())
/** Encounters that would be left with a "Deleted NPC" entry if this NPC is deleted. */
const usedIn = computed(() => encounterStore.encounters.filter((e) => e.entries.some((x) => x.npcId === props.npc.id)))
</script>

<template>
  <v-row>
    <v-col cols="12" lg="6">
      <v-card variant="outlined" class="mb-4">
        <v-card-text>
          <div class="d-flex flex-wrap align-start ga-3">
            <v-text-field
              v-model="nameDraft"
              label="Name"
              density="compact"
              :error-messages="nameError ?? undefined"
              class="flex-grow-1"
              style="min-width: 200px"
              @blur="commitName"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
            <div class="d-flex align-center ga-2 pt-1">
              <span class="text-body-2 text-medium-emphasis">Tier</span>
              <v-btn-toggle v-model="tierModel" density="compact" variant="outlined" divided mandatory>
                <v-btn :value="1">1</v-btn>
                <v-btn :value="2">2</v-btn>
                <v-btn :value="3">3</v-btn>
              </v-btn-toggle>
            </div>
          </div>
          <div class="d-flex flex-wrap align-center ga-2">
            <span class="text-body-2 text-medium-emphasis">Class: {{ base.name }}</span>
            <NpcTypeChip v-if="base.colorType" :type-name="base.colorType" />
            <v-spacer />
            <template v-if="confirmingDelete">
              <span class="text-body-2">
                Delete {{ npc.name }}?
                <template v-if="usedIn.length">
                  It's used in {{ usedIn.map((e) => e.name).join(', ') }}.
                </template>
              </span>
              <v-btn size="small" variant="text" @click="confirmingDelete = false">Cancel</v-btn>
              <v-btn size="small" color="error" variant="flat" @click="store.remove(npc.id)">Delete</v-btn>
            </template>
            <v-btn v-else size="small" variant="text" color="error" prepend-icon="mdi-delete" @click="confirmingDelete = true">
              Delete
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <v-card variant="outlined" class="mb-4">
        <v-card-title class="text-subtitle-1">Tags</v-card-title>
        <v-card-text>
          <NpcTagEditor :npc="npc" />
        </v-card-text>
      </v-card>

      <v-card variant="outlined" class="mb-4">
        <v-card-title class="text-subtitle-1">Template</v-card-title>
        <v-card-text>
          <v-select
            v-model="templateModel"
            :items="[{ title: 'None', value: null }, ...templates.map((t) => ({ title: t.name, value: t.id }))]"
            density="compact"
            class="mb-2"
          />
          <template v-if="template">
            <p class="text-body-2 font-italic text-medium-emphasis mb-2">{{ template.description }}</p>
            <div v-for="f in template.features" :key="f.name" class="text-body-2 mb-1">
              <strong>{{ f.name }}:</strong> {{ f.text }}
            </div>
            <div class="text-overline text-medium-emphasis mt-2">Optional {{ template.name }} Features</div>
            <v-checkbox
              v-for="f in template.optionalFeatures"
              :key="f.name"
              :model-value="npc.templateFeatureNames.includes(f.name)"
              density="compact"
              hide-details
              @update:model-value="store.toggleTemplateFeature(npc.id, f.name)"
            >
              <template #label>
                <span class="text-body-2">
                  <strong>{{ f.name }}<span v-if="f.recharge"> (Recharge [!])</span>:</strong> {{ f.text }}
                </span>
              </template>
            </v-checkbox>
          </template>
        </v-card-text>
      </v-card>

      <v-card variant="outlined" class="mb-4">
        <v-card-title class="text-subtitle-1">Optional Features</v-card-title>
        <v-card-text>
          <v-alert
            :type="chosenOptionalCount > npc.tier ? 'warning' : 'info'"
            variant="tonal"
            density="compact"
            class="mb-2 text-body-2"
          >
            {{ chosenOptionalCount }} optional feature{{ chosenOptionalCount === 1 ? '' : 's' }} chosen. Rule of
            thumb: up to the NPC's tier ({{ npc.tier }}).
            <template v-if="chosenMajorCount">
              A Major Feature makes the NPC a larger threat without changing its tier.
            </template>
          </v-alert>
          <p v-if="!optionalSections.length" class="text-body-2 text-medium-emphasis">
            {{ base.name }} has no optional features.
          </p>
          <div v-for="s in optionalSections" :key="s.section" class="mb-2">
            <div class="text-overline text-medium-emphasis">{{ s.title }}</div>
            <v-checkbox
              v-for="e in s.entries"
              :key="e.name"
              :model-value="npc.optionalFeatureKeys.includes(optionalFeatureKey(s.section, e.name))"
              density="compact"
              hide-details
              @update:model-value="store.toggleOptionalFeature(npc.id, optionalFeatureKey(s.section, e.name))"
            >
              <template #label>
                <span class="text-body-2">
                  <strong>{{ entryHeading(e.name, e.tags) }}<span v-if="e.recharge"> (Recharge [!])</span>:</strong>
                  {{ resolveTierText(e.text, npc.tier) }}
                </span>
              </template>
            </v-checkbox>
          </div>
        </v-card-text>
      </v-card>

      <v-card variant="outlined" class="mb-4">
        <v-card-title class="d-flex align-center text-subtitle-1">
          Stats
          <v-spacer />
          <v-btn size="small" variant="text" @click="store.resetStats(npc.id)">Reset to {{ base.name }}</v-btn>
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">
            HP, Willpower, Speed, Effect Saves, and attack Targets/damage update from these.
          </p>
          <div class="text-overline text-medium-emphasis">Attributes</div>
          <div v-if="npc.attributes" class="stat-grid mb-3">
            <v-text-field
              v-for="a in ATTRIBUTES"
              :key="a"
              :model-value="npc.attributes[a]"
              :label="label(a)"
              :hint="npc.attributes[a] !== baseAttribute(a) ? `${base.name}: ${baseAttribute(a)}` : undefined"
              persistent-hint
              type="number"
              density="compact"
              @update:model-value="(v) => setAttribute(a, v)"
            />
          </div>
          <div v-else-if="npc.parts" class="table-scroll mb-3">
            <v-table density="compact">
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th v-for="p in PARTS" :key="p">{{ label(p) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in ATTRIBUTES" :key="a">
                  <td>{{ label(a) }}</td>
                  <td v-for="p in PARTS" :key="p">
                    <v-text-field
                      :model-value="npc.parts[p][a]"
                      type="number"
                      density="compact"
                      hide-details
                      variant="plain"
                      style="max-width: 80px"
                      @update:model-value="(v) => setAttribute(a, v, p)"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
          <div class="text-overline text-medium-emphasis">Skills</div>
          <div class="stat-grid mb-3">
            <v-text-field
              v-for="s in SKILLS"
              :key="s"
              :model-value="npc.skills[s]"
              :label="label(s)"
              type="number"
              density="compact"
              hide-details
              @update:model-value="(v) => setSkill(s, v)"
            />
          </div>
          <template v-if="npc.resistance !== undefined">
            <div class="text-overline text-medium-emphasis">Armor</div>
            <div class="stat-grid">
              <v-text-field
                :model-value="npc.resistance"
                label="Base Resistance"
                hint="Before optional features"
                persistent-hint
                type="number"
                density="compact"
                @update:model-value="setResistance"
              />
            </div>
          </template>
        </v-card-text>
      </v-card>

      <v-card variant="outlined" class="mb-4">
        <v-card-title class="text-subtitle-1">Notes</v-card-title>
        <v-card-text>
          <NotesEditor :key="npc.id" :model-value="npc.notes" @change="(v) => store.setNotes(npc.id, v)" />
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" lg="6">
      <div class="preview">
        <div class="text-overline text-medium-emphasis">Stat Block</div>
        <NpcStatBlock :npc="resolved" :tier="npc.tier" :based-on="`${base.name} · Tier ${npc.tier}`" :custom-tags="npc.customTags" />
      </div>
    </v-col>
  </v-row>
</template>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px 12px;
}
.table-scroll {
  overflow-x: auto;
}
.preview {
  position: sticky;
  top: calc(64px + env(safe-area-inset-top, 0px) + 16px);
}
</style>
