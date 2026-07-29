<script setup lang="ts">
import { computed, ref } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import type { ITalentData, ITalentPrerequisite } from '@/classes/Talent'
import { AttributeId, SkillId, TalentCategory } from '@/classes/enums'

const activeCategory = ref<TalentCategory>(TalentCategory.Narrative)
const searchText = ref('')

const talentById = new Map(
  [...CoreContent.talents.narrative, ...CoreContent.talents.combat].map((t) => [t.id, t.name]),
)

function attributeName(id: AttributeId): string {
  return CoreContent.attributes.find((a) => a.id === id)?.name ?? id
}
function skillName(id: SkillId): string {
  return CoreContent.skills.find((s) => s.id === id)?.name ?? id
}
function socialClassName(id: string): string {
  return CoreContent.lifepath.socialClass.options.find((o) => o.id === id)?.name ?? id
}
function careerName(id: string): string {
  return CoreContent.lifepath.career.options.find((o) => o.id === id)?.name ?? id
}

function describePrerequisite(prereq: ITalentPrerequisite): string {
  const parts: string[] = []
  if (prereq.attribute) parts.push(`${attributeName(prereq.attribute.id)} ${prereq.attribute.minRating}`)
  if (prereq.attributeAny) {
    parts.push(`${prereq.attributeAny.ids.map(attributeName).join(', ')} (any) ${prereq.attributeAny.minRating}`)
  }
  if (prereq.skill) parts.push(`${skillName(prereq.skill.id)} ${prereq.skill.minRating}`)
  if (prereq.socialClass) parts.push(socialClassName(prereq.socialClass))
  if (prereq.socialClassAny) parts.push(`${prereq.socialClassAny.map(socialClassName).join(', ')} (any)`)
  if (prereq.career) parts.push(`${careerName(prereq.career)} career`)
  if (prereq.magickDomain) parts.push(`${prereq.magickDomain[0].toUpperCase()}${prereq.magickDomain.slice(1)} Magick`)
  if (prereq.priorTalentId) parts.push(talentById.get(prereq.priorTalentId) ?? prereq.priorTalentId)
  if (prereq.minLevel) parts.push(`Level ${prereq.minLevel}+`)
  return parts.length ? parts.join(', ') : 'None'
}

/** Groups the index (name/subgroup) by subgroup, in source order. */
const groupSections = computed(() => {
  const entries = CoreContent.talents.index.filter((e) => e.category === activeCategory.value)
  const bySubgroup = new Map<string, string[]>()
  for (const e of entries) {
    if (!bySubgroup.has(e.subgroup)) bySubgroup.set(e.subgroup, [])
    bySubgroup.get(e.subgroup)!.push(e.name)
  }
  const filtered = [...bySubgroup.entries()].map(([subgroup, names]) => ({
    subgroup,
    names: names.filter((n) => !searchText.value.trim() || n.toLowerCase().includes(searchText.value.trim().toLowerCase())),
  }))
  return filtered.filter((s) => s.names.length > 0)
})

const selectedGroupName = ref<string | null>(null)

const allTalents = computed<ITalentData[]>(() =>
  activeCategory.value === TalentCategory.Narrative ? CoreContent.talents.narrative : CoreContent.talents.combat,
)

const selectedGroupTalents = computed(() =>
  selectedGroupName.value ? allTalents.value.filter((t) => t.group === selectedGroupName.value) : [],
)

function selectCategory(category: TalentCategory) {
  activeCategory.value = category
  selectedGroupName.value = null
}
</script>

<template>
  <div>
    <v-tabs :model-value="activeCategory" class="mb-3" @update:model-value="(v) => selectCategory(v as TalentCategory)">
      <v-tab :text="`Narrative (${CoreContent.talents.narrative.length} abilities)`" :value="TalentCategory.Narrative" />
      <v-tab :text="`Combat (${CoreContent.talents.combat.length} abilities)`" :value="TalentCategory.Combat" />
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
        <div style="max-height: 70vh; overflow-y: auto">
          <div v-for="section in groupSections" :key="section.subgroup" class="mb-3">
            <div class="text-overline text-medium-emphasis">{{ section.subgroup }}</div>
            <v-list density="compact">
              <v-list-item
                v-for="name in section.names"
                :key="name"
                :title="name"
                :active="selectedGroupName === name"
                color="primary"
                @click="selectedGroupName = name"
              />
            </v-list>
          </div>
        </div>
      </v-col>

      <v-col cols="12" md="8">
        <template v-if="selectedGroupTalents.length">
          <h3 class="text-h6 mb-2">{{ selectedGroupName }}</h3>
          <v-card v-for="t in selectedGroupTalents" :key="t.id" variant="outlined" class="mb-2">
            <v-card-title class="d-flex align-center justify-space-between">
              <span>{{ t.name }}</span>
              <v-chip v-if="t.tier" size="small">Tier {{ t.tier }}</v-chip>
            </v-card-title>
            <v-card-subtitle>Requires: {{ describePrerequisite(t.prerequisites) }}</v-card-subtitle>
            <v-card-text>{{ t.effectText }}</v-card-text>
          </v-card>
        </template>
        <p v-else class="text-medium-emphasis">Select an Archetype or Talent Tree on the left.</p>
      </v-col>
    </v-row>
  </div>
</template>
