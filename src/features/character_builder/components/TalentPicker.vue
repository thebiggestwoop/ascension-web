<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AttributeId, SkillId, SocialClassId } from '@/classes/enums'
import type { ITalentPrereqContext } from '@/classes/Talent'
import { meetsTalentPrerequisites } from '@/classes/Talent'
import { CoreContent } from '@/io/ContentLoader'

/**
 * Full free-pick Talent selection per Step Six: "Your character gains four Tier 1 Combat
 * Talents and three Narrative Talents which may be chosen freely, so long as any Talent
 * prerequisites are met." All 21 Narrative Archetypes (105 abilities) and all 68 Combat
 * Talent Trees (their Tier-1 root ability only, since only Tier 1 is grantable here) are
 * available, gated live against the in-progress draft.
 */
const props = defineProps<{
  attributes: Record<AttributeId, number>
  skills: Record<SkillId, number>
  socialClassId?: SocialClassId
  careerId?: string
}>()
const emit = defineEmits<{ change: [payload: { narrativeTalentIds: string[]; combatTalentIds: string[] }] }>()

const NARRATIVE_PICK_COUNT = 3
const COMBAT_PICK_COUNT = 4

const DOMAIN_BY_GROUP: Record<string, string> = {
  'Arcane Magick': 'arcane',
  'Light Magick': 'light',
  'Dark Magick': 'dark',
}

const subgroupByGroupName = new Map(CoreContent.talents.index.map((e) => [e.name, e.subgroup]))

const combatTier1 = CoreContent.talents.combat.filter((t) => t.tier === 1)

const selectedNarrativeIds = ref<string[]>([])
const selectedCombatIds = ref<string[]>([])
const searchText = ref('')

/**
 * A character only has access to a Magick Domain (and thus its "Requires Spellcaster"
 * Talents, and the matching Magickal Narrative Archetype) once they've taken that domain's
 * Tier 1 Combat Talent - which can happen in this very batch of 4 picks, so this must react
 * live to selectedCombatIds rather than only to the draft as it stood entering this step.
 */
const magickDomains = computed(() => {
  const domains = new Set<string>()
  for (const id of selectedCombatIds.value) {
    const talent = combatTier1.find((t) => t.id === id)
    if (talent && DOMAIN_BY_GROUP[talent.group]) domains.add(DOMAIN_BY_GROUP[talent.group])
  }
  return domains
})

const prereqContext = computed<ITalentPrereqContext>(() => ({
  attributes: props.attributes,
  skills: props.skills,
  socialClassId: props.socialClassId,
  careerId: props.careerId,
  magickDomains: magickDomains.value,
  talentIds: new Set([...selectedNarrativeIds.value, ...selectedCombatIds.value]),
  level: 1,
}))

function groupByArchetype<T extends { group: string }>(items: T[]) {
  const bySubgroup = new Map<string, Map<string, T[]>>()
  for (const item of items) {
    const subgroup = subgroupByGroupName.get(item.group) ?? 'Other'
    if (!bySubgroup.has(subgroup)) bySubgroup.set(subgroup, new Map())
    const groups = bySubgroup.get(subgroup)!
    if (!groups.has(item.group)) groups.set(item.group, [])
    groups.get(item.group)!.push(item)
  }
  return [...bySubgroup.entries()].map(([subgroup, groups]) => ({
    subgroup,
    groups: [...groups.entries()].map(([groupName, talents]) => ({ groupName, talents })),
  }))
}

function matchesSearch(name: string): boolean {
  if (!searchText.value.trim()) return true
  return name.toLowerCase().includes(searchText.value.trim().toLowerCase())
}

const narrativeSections = computed(() =>
  groupByArchetype(CoreContent.talents.narrative)
    .map((section) => ({
      ...section,
      groups: section.groups
        .map((g) => ({ ...g, talents: g.talents.filter((t) => matchesSearch(t.name) || matchesSearch(g.groupName)) }))
        .filter((g) => g.talents.length > 0),
    }))
    .filter((s) => s.groups.length > 0),
)

const combatSections = computed(() =>
  groupByArchetype(combatTier1)
    .map((section) => ({
      ...section,
      groups: section.groups
        .map((g) => ({ ...g, talents: g.talents.filter((t) => matchesSearch(t.name) || matchesSearch(g.groupName)) }))
        .filter((g) => g.talents.length > 0),
    }))
    .filter((s) => s.groups.length > 0),
)

watch(
  [selectedNarrativeIds, selectedCombatIds],
  () => {
    emit('change', {
      narrativeTalentIds: selectedNarrativeIds.value,
      combatTalentIds: selectedCombatIds.value,
    })
  },
  { deep: true },
)
</script>

<template>
  <div>
    <v-text-field
      v-model="searchText"
      label="Search Talents"
      density="compact"
      prepend-inner-icon="mdi-magnify"
      clearable
      class="mb-2"
    />

    <div class="text-subtitle-1 mt-2">
      Narrative Talents ({{ selectedNarrativeIds.length }} / {{ NARRATIVE_PICK_COUNT }})
    </div>
    <v-expansion-panels variant="accordion" multiple>
      <v-expansion-panel v-for="section in narrativeSections" :key="section.subgroup" :title="section.subgroup">
        <v-expansion-panel-text>
          <div v-for="g in section.groups" :key="g.groupName" class="mb-3">
            <div class="text-subtitle-2">{{ g.groupName }}</div>
            <v-checkbox
              v-for="t in g.talents"
              :key="t.id"
              v-model="selectedNarrativeIds"
              :value="t.id"
              :label="t.name"
              :hint="
                meetsTalentPrerequisites(t.prerequisites, prereqContext)
                  ? t.effectText
                  : `Prerequisite not met - ${t.effectText}`
              "
              persistent-hint
              density="compact"
              hide-details="auto"
              :disabled="
                (!selectedNarrativeIds.includes(t.id) && selectedNarrativeIds.length >= NARRATIVE_PICK_COUNT) ||
                !meetsTalentPrerequisites(t.prerequisites, prereqContext)
              "
            />
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <div class="text-subtitle-1 mt-4">
      Combat Talents - Tier 1 ({{ selectedCombatIds.length }} / {{ COMBAT_PICK_COUNT }})
    </div>
    <v-expansion-panels variant="accordion" multiple>
      <v-expansion-panel v-for="section in combatSections" :key="section.subgroup" :title="section.subgroup">
        <v-expansion-panel-text>
          <div v-for="g in section.groups" :key="g.groupName" class="mb-3">
            <div class="text-subtitle-2">{{ g.groupName }}</div>
            <v-checkbox
              v-for="t in g.talents"
              :key="t.id"
              v-model="selectedCombatIds"
              :value="t.id"
              :label="t.name"
              :hint="
                meetsTalentPrerequisites(t.prerequisites, prereqContext)
                  ? t.effectText
                  : `Prerequisite not met - ${t.effectText}`
              "
              persistent-hint
              density="compact"
              hide-details="auto"
              :disabled="
                (!selectedCombatIds.includes(t.id) && selectedCombatIds.length >= COMBAT_PICK_COUNT) ||
                !meetsTalentPrerequisites(t.prerequisites, prereqContext)
              "
            />
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>
