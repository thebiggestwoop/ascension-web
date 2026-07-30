<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AttributeId, SkillId, SocialClassId } from '@/classes/enums'
import type { ITalentPrereqContext } from '@/classes/Talent'
import { meetsTalentPrerequisites } from '@/classes/Talent'
import { CoreContent } from '@/io/ContentLoader'

/**
 * Free-pick Talent selection, used both by Step Six ("four Tier 1 Combat Talents and three
 * Narrative Talents, chosen freely so long as prerequisites are met") and by leveling up
 * (which grants a level-specific count of each, at any Tier the character's level allows,
 * excluding Talents already held). All 21 Narrative Archetypes and 68 Combat Talent Trees are
 * available, gated live against the character's current + in-progress-batch state.
 */
const props = withDefaults(
  defineProps<{
    attributes: Record<AttributeId, number>
    skills: Record<SkillId, number>
    socialClassId?: SocialClassId
    careerId?: string
    /** Talent ids already held - excluded from the pickable pool, but still counted for priorTalentId/Magick Domain access. */
    heldTalentIds?: string[]
    narrativeCount?: number
    combatCount?: number
    /** Highest Combat Talent Tier selectable (1 at character creation; up to 3 once Level 3+). */
    maxTier?: number
    /** Character level *after* this batch is applied, for minLevel-gated (Tier 3) prerequisites. */
    level?: number
  }>(),
  {
    heldTalentIds: () => [],
    narrativeCount: 3,
    combatCount: 4,
    maxTier: 1,
    level: 0,
  },
)
const emit = defineEmits<{ change: [payload: { narrativeTalentIds: string[]; combatTalentIds: string[] }] }>()

const DOMAIN_BY_GROUP: Record<string, string> = {
  'Arcane Magick': 'arcane',
  'Light Magick': 'light',
  'Dark Magick': 'dark',
}

const subgroupByGroupName = new Map(CoreContent.talents.index.map((e) => [e.name, e.subgroup]))

const narrativePool = computed(() => CoreContent.talents.narrative.filter((t) => !props.heldTalentIds.includes(t.id)))
const combatPool = computed(() =>
  CoreContent.talents.combat.filter((t) => (t.tier ?? 1) <= props.maxTier && !props.heldTalentIds.includes(t.id)),
)

const selectedNarrativeIds = ref<string[]>([])
const selectedCombatIds = ref<string[]>([])
const searchText = ref('')

/**
 * A character has access to a Magick Domain (and thus its "Requires Spellcaster" Talents and
 * the matching Magickal Narrative Archetype) once they hold that domain's Tier 1 Combat
 * Talent - whether from before this batch (heldTalentIds) or picked within it, since a
 * character can take a Magick Domain Talent and immediately qualify for Spellcaster-gated
 * content in the same sitting.
 */
const magickDomains = computed(() => {
  const domains = new Set<string>()
  for (const id of [...props.heldTalentIds, ...selectedCombatIds.value]) {
    const talent = CoreContent.talents.combat.find((t) => t.id === id)
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
  talentIds: new Set([...props.heldTalentIds, ...selectedNarrativeIds.value, ...selectedCombatIds.value]),
  level: props.level,
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
  groupByArchetype(narrativePool.value)
    .map((section) => ({
      ...section,
      groups: section.groups
        .map((g) => ({ ...g, talents: g.talents.filter((t) => matchesSearch(t.name) || matchesSearch(g.groupName)) }))
        .filter((g) => g.talents.length > 0),
    }))
    .filter((s) => s.groups.length > 0),
)

const combatSections = computed(() =>
  groupByArchetype(combatPool.value)
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
    // Spread into plain arrays - selectedNarrativeIds.value/selectedCombatIds.value are Vue
    // reactive Proxies (refs wrapping arrays get deep-reactive-wrapped), and callers eventually
    // store this payload verbatim (creationRecord, levelUpHistory) inside character data that
    // later gets structuredClone()'d; a live Proxy embedded in that graph makes the clone throw
    // ("could not be cloned"), even though iterating/spreading it elsewhere was always fine.
    emit('change', {
      narrativeTalentIds: [...selectedNarrativeIds.value],
      combatTalentIds: [...selectedCombatIds.value],
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

    <template v-if="narrativeCount > 0">
      <div class="text-subtitle-1 mt-2">
        Narrative Talents ({{ selectedNarrativeIds.length }} / {{ narrativeCount }})
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
                  (!selectedNarrativeIds.includes(t.id) && selectedNarrativeIds.length >= narrativeCount) ||
                  !meetsTalentPrerequisites(t.prerequisites, prereqContext)
                "
              />
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>

    <template v-if="combatCount > 0">
      <div class="text-subtitle-1 mt-4">
        Combat Talents ({{ selectedCombatIds.length }} / {{ combatCount }})
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
                :label="t.tier ? `${t.name} (Tier ${t.tier})` : t.name"
                :hint="
                  meetsTalentPrerequisites(t.prerequisites, prereqContext)
                    ? t.effectText
                    : `Prerequisite not met - ${t.effectText}`
                "
                persistent-hint
                density="compact"
                hide-details="auto"
                :disabled="
                  (!selectedCombatIds.includes(t.id) && selectedCombatIds.length >= combatCount) ||
                  !meetsTalentPrerequisites(t.prerequisites, prereqContext)
                "
              />
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </div>
</template>
