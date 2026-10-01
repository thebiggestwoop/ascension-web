<script setup lang="ts">
/** Full stat block for one NPC, with every tiered value resolved to `tier` (or shown in the
 * rulebook's A/B/C form when tier is null). */
import { computed } from 'vue'
import type { INpcData, NpcTier, Tiered } from '@/classes/Npc'
import { formatTiered, resolveTierText } from '@/classes/Npc'
import { AttributeId, SkillId } from '@/classes/enums'
import { CoreContent } from '@/io/ContentLoader'
import NpcTypeChip from './NpcTypeChip.vue'
import NpcEntryList from './NpcEntryList.vue'

const props = defineProps<{ npc: INpcData; tier: NpcTier | null; basedOn?: string; customTags?: string[] }>()

const ATTRIBUTES = Object.values(AttributeId)
const SKILLS = Object.values(SkillId)
const PARTS = ['head', 'torso', 'legs'] as const

const CATEGORY_LABEL = { standard: 'Standard', chaff: 'Chaff', monumental: 'Monumental Foe' }

/** Tags already conveyed by the type/category chips. */
const extraTags = computed(() =>
  props.npc.tags.filter((t) => t !== props.npc.colorType && t !== CATEGORY_LABEL[props.npc.category]),
)

function label(id: string): string {
  return id[0].toUpperCase() + id.slice(1)
}

function t(value: Tiered): string {
  return formatTiered(value, props.tier)
}

const hpLabel = computed(() => {
  const hp = t(props.npc.hp)
  return props.npc.healthBars > 1 ? `${hp} × ${props.npc.healthBars} Health Bars` : hp
})

const speedLabel = computed(() => {
  let s = t(props.npc.speed)
  if (props.npc.mountedSpeed) s += ` (Mounted ${t(props.npc.mountedSpeed)})`
  if (props.npc.flyingSpeed) s += ` (Flying ${t(props.npc.flyingSpeed)})`
  return s
})

const rules = CoreContent.npcs.templates.rules
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="d-flex flex-wrap align-center ga-2">
      <span class="mr-2">{{ npc.name }}</span>
      <NpcTypeChip v-if="npc.colorType" :type-name="npc.colorType" />
      <v-chip size="small" variant="outlined">{{ CATEGORY_LABEL[npc.category] }}</v-chip>
      <v-chip v-for="tag in extraTags" :key="tag" size="small" variant="tonal">{{ tag }}</v-chip>
      <v-chip
        v-for="tag in customTags"
        :key="`custom-${tag}`"
        size="small"
        variant="outlined"
        color="primary"
        prepend-icon="mdi-tag-outline"
      >
        {{ tag }}
      </v-chip>
    </v-card-title>
    <v-card-subtitle v-if="basedOn" class="text-wrap">{{ basedOn }}</v-card-subtitle>
    <v-card-subtitle class="text-wrap font-italic">{{ npc.description }}</v-card-subtitle>

    <v-card-text>
      <div class="d-flex flex-wrap ga-4 mb-4 text-body-2">
        <div><strong>HP</strong> {{ hpLabel }}</div>
        <div v-if="npc.morale !== undefined"><strong>Morale</strong> {{ npc.morale }}</div>
        <div><strong>Willpower</strong> {{ npc.willpower ? t(npc.willpower) : '—' }}</div>
        <div v-if="npc.resistance !== undefined"><strong>Resistance</strong> {{ npc.resistance }}</div>
        <div><strong>Speed</strong> {{ speedLabel }}</div>
        <div v-if="npc.size"><strong>Size</strong> {{ npc.size }}</div>
      </div>

      <v-row dense class="mb-2">
        <v-col cols="12" :sm="npc.parts ? 12 : 7">
          <div class="table-scroll">
            <v-table v-if="npc.attributes" density="compact">
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th class="text-center">Score</th>
                  <th v-if="npc.effectSaves" class="text-center">Effect Save</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in ATTRIBUTES" :key="a">
                  <td>{{ label(a) }}</td>
                  <td class="text-center">{{ t(npc.attributes[a]) }}</td>
                  <td v-if="npc.effectSaves" class="text-center">{{ t(npc.effectSaves[a]) }}</td>
                </tr>
              </tbody>
            </v-table>
            <v-table v-else-if="npc.parts" density="compact">
              <thead>
                <tr>
                  <th>Attribute (Save)</th>
                  <th v-for="p in PARTS" :key="p" class="text-center">{{ label(p) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in ATTRIBUTES" :key="a">
                  <td>{{ label(a) }}</td>
                  <td v-for="p in PARTS" :key="p" class="text-center">
                    {{ t(npc.parts[p].attributes[a]) }} ({{ t(npc.parts[p].effectSaves[a]) }})
                  </td>
                </tr>
                <tr>
                  <td><strong>Resistance</strong></td>
                  <td v-for="p in PARTS" :key="p" class="text-center">{{ npc.parts[p].resistance }}</td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-col>
        <v-col cols="12" :sm="npc.parts ? 6 : 5">
          <v-table density="compact">
            <thead>
              <tr>
                <th>Skill</th>
                <th class="text-center">Rank</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in SKILLS" :key="s">
                <td>{{ label(s) }}</td>
                <td class="text-center">{{ t(npc.skills[s]) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>

      <p v-if="npc.special" class="text-body-2 mb-4"><strong>Special:</strong> {{ resolveTierText(npc.special, tier) }}</p>

      <NpcEntryList title="Features" :entries="npc.features" :tier="tier" />
      <NpcEntryList title="Attacks" :entries="npc.attacks" :note="npc.attacksNote" :tier="tier" />
      <NpcEntryList title="Group Attacks" :entries="npc.groupAttacks" :tier="tier" />
      <NpcEntryList title="Division Attacks" :entries="npc.divisionAttacks" :tier="tier" />
      <NpcEntryList title="Actions" :entries="npc.actions" :tier="tier" />
      <NpcEntryList title="Minor Actions" :entries="npc.minorActions" :tier="tier" />
      <NpcEntryList title="Optional Features" :entries="npc.optionalFeatures" :tier="tier" />
      <NpcEntryList title="Optional Major Features" :entries="npc.optionalMajorFeatures" :tier="tier" />

      <v-expansion-panels v-if="npc.category !== 'standard'" variant="accordion">
        <v-expansion-panel v-if="npc.category === 'chaff'" title="Chaff rules">
          <v-expansion-panel-text class="text-body-2">
            <p class="mb-2">{{ rules.chaff.text }}</p>
            <p class="mb-2"><strong>Group Health.</strong> {{ rules.chaff.groupHealth }}</p>
            <p><strong>Group Actions.</strong> {{ rules.chaff.groupActions }}</p>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel v-if="npc.category === 'monumental'" title="Monumental Foe rules">
          <v-expansion-panel-text class="text-body-2">
            <p class="mb-2">{{ rules.monumentalFoe.text }}</p>
            <p class="mb-2"><strong>Attributes and Skills.</strong> {{ rules.monumentalFoe.attributesAndSkills }}</p>
            <p><strong>Health.</strong> {{ rules.monumentalFoe.health }}</p>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.table-scroll {
  overflow-x: auto;
}
</style>
