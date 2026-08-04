<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AttributeId, SkillId } from '@/classes/enums'
import type { ITalentData, ITalentPrereqContext } from '@/classes/Talent'
import { meetsTalentPrerequisites } from '@/classes/Talent'
import { SPELLCASTER_TALENT_IDS } from '@/classes/Spell'
import { CoreContent } from '@/io/ContentLoader'
import { describeTalentPrerequisite } from '@/ui/describeTalentPrerequisite'

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
    /** Names of Traits the character currently holds - drives `trait`-gated prerequisites. */
    heldTraitNames?: string[]
    careerId?: string
    /** Talent ids already held - excluded from the pickable pool, but still counted for priorTalentId/Magick Domain access. */
    heldTalentIds?: string[]
    narrativeCount?: number
    combatCount?: number
    /** Highest Combat Talent Tier selectable (1 at character creation; up to 3 once Level 3+). */
    maxTier?: number
    /** Character level *after* this batch is applied, for minLevel-gated (Tier 3) prerequisites. */
    level?: number
    /** Pre-checks these Talents on mount - e.g. an Archetype pregen's own picks, so starting
     * from an Archetype shows the same picker as Quick Build with its choices already made. */
    initialNarrativeTalentIds?: string[]
    initialCombatTalentIds?: string[]
  }>(),
  {
    heldTraitNames: () => [],
    heldTalentIds: () => [],
    narrativeCount: 3,
    combatCount: 4,
    maxTier: 1,
    level: 0,
    initialNarrativeTalentIds: () => [],
    initialCombatTalentIds: () => [],
  },
)
const emit = defineEmits<{ change: [payload: { narrativeTalentIds: string[]; combatTalentIds: string[] }] }>()

const DOMAIN_BY_GROUP: Record<string, string> = {
  'Arcane Magick': 'arcane',
  'Light Magick': 'light',
  'Dark Magick': 'dark',
}

const subgroupByGroupName = new Map(CoreContent.talents.index.map((e) => [e.name, e.subgroup]))
const flavorTextByGroupName = new Map(CoreContent.talents.index.map((e) => [e.name, e.flavorText]))

const narrativePool = computed(() => CoreContent.talents.narrative.filter((t) => !props.heldTalentIds.includes(t.id)))
const combatPool = computed(() =>
  CoreContent.talents.combat.filter((t) => (t.tier ?? 1) <= props.maxTier && !props.heldTalentIds.includes(t.id)),
)

const selectedNarrativeIds = ref<string[]>([...props.initialNarrativeTalentIds])
const selectedCombatIds = ref<string[]>([...props.initialCombatTalentIds])
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

/**
 * A character becomes a Spellcaster the moment they hold (or, within this same batch, pick)
 * any Tier 1 Magick Domain Talent - mirroring `magickDomains` above so that Spellcaster-gated
 * Narrative/Combat Talents unlock immediately in the same sitting.
 */
const hasSpellcasterTrait = computed(
  () =>
    props.heldTraitNames.includes('Spellcaster') ||
    [...props.heldTalentIds, ...selectedCombatIds.value].some((id) => SPELLCASTER_TALENT_IDS.includes(id)),
)

const prereqContext = computed<ITalentPrereqContext>(() => ({
  attributes: props.attributes,
  skills: props.skills,
  traitNames: hasSpellcasterTrait.value
    ? new Set([...props.heldTraitNames, 'Spellcaster'])
    : new Set(props.heldTraitNames),
  careerId: props.careerId,
  magickDomains: magickDomains.value,
  talentIds: new Set([...props.heldTalentIds, ...selectedNarrativeIds.value, ...selectedCombatIds.value]),
  level: props.level,
}))

/** Group names the character already holds at least one Talent from - drives the "continue a
 * Talent Tree you already have" quick list so leveling up doesn't require hunting through the
 * full alphabetical list below just to take the next tier of a tree already started. */
const heldCombatGroups = computed(() => {
  const groups = new Set<string>()
  for (const id of props.heldTalentIds) {
    const talent = CoreContent.talents.combat.find((t) => t.id === id)
    if (talent) groups.add(talent.group)
  }
  return groups
})
const heldNarrativeGroups = computed(() => {
  const groups = new Set<string>()
  for (const id of props.heldTalentIds) {
    const talent = CoreContent.talents.narrative.find((t) => t.id === id)
    if (talent) groups.add(talent.group)
  }
  return groups
})

function groupByName<T extends { group: string }>(items: T[]) {
  const byGroup = new Map<string, T[]>()
  for (const item of items) {
    if (!byGroup.has(item.group)) byGroup.set(item.group, [])
    byGroup.get(item.group)!.push(item)
  }
  return [...byGroup.entries()].map(([groupName, talents]) => ({ groupName, talents }))
}

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

/** First hint line: the prerequisite, small - stays the default hint size. */
function prereqLine(t: ITalentData): string {
  return (
    `Requires: ${describeTalentPrerequisite(t.prerequisites)}` +
    (meetsTalentPrerequisites(t.prerequisites, prereqContext.value) ? '' : ' (not met)')
  )
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

const narrativeContinuationGroups = computed(() =>
  groupByName(narrativePool.value.filter((t) => heldNarrativeGroups.value.has(t.group)))
    .map((g) => ({ ...g, talents: g.talents.filter((t) => matchesSearch(t.name) || matchesSearch(g.groupName)) }))
    .filter((g) => g.talents.length > 0),
)
const combatContinuationGroups = computed(() =>
  groupByName(combatPool.value.filter((t) => heldCombatGroups.value.has(t.group)))
    .map((g) => ({ ...g, talents: g.talents.filter((t) => matchesSearch(t.name) || matchesSearch(g.groupName)) }))
    .filter((g) => g.talents.length > 0),
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
  // immediate: so a caller that passes initialNarrativeTalentIds/initialCombatTalentIds (an
  // Archetype's own picks) gets an immediate 'change' reflecting them, rather than the parent's
  // own talentPicks ref sitting empty until the player manually touches a checkbox.
  { deep: true, immediate: true },
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

    <template v-if="combatCount > 0">
      <div class="text-subtitle-1 mt-2">
        Combat Talents ({{ selectedCombatIds.length }} / {{ combatCount }})
      </div>

      <template v-if="combatContinuationGroups.length">
        <div class="text-subtitle-2 text-medium-emphasis mt-1 mb-1">Continue a Talent Tree You Already Have</div>
        <div v-for="g in combatContinuationGroups" :key="g.groupName" class="mb-3">
          <div class="text-body-1 font-weight-medium">{{ g.groupName }}</div>
          <v-checkbox
            v-for="t in g.talents"
            :key="t.id"
            class="talent-checkbox"
            v-model="selectedCombatIds"
            :value="t.id"
            :label="t.tier ? `${t.name} (Tier ${t.tier})` : t.name"
            :messages="[prereqLine(t), t.effectText]"
            density="compact"
            hide-details="auto"
            :disabled="
              (!selectedCombatIds.includes(t.id) && selectedCombatIds.length >= combatCount) ||
              !meetsTalentPrerequisites(t.prerequisites, prereqContext)
            "
          />
        </div>
        <v-divider class="mb-3" />
        <div class="text-subtitle-2 text-medium-emphasis mb-1">All Talent Trees</div>
      </template>

      <v-expansion-panels variant="accordion" multiple>
        <v-expansion-panel v-for="section in combatSections" :key="section.subgroup" :title="section.subgroup">
          <v-expansion-panel-text>
            <div v-for="g in section.groups" :key="g.groupName" class="mb-3">
              <div class="text-body-1 font-weight-medium">{{ g.groupName }}</div>
              <p v-if="flavorTextByGroupName.get(g.groupName)" class="text-medium-emphasis font-italic text-body-2 mb-1">
                {{ flavorTextByGroupName.get(g.groupName) }}
              </p>
              <v-checkbox
                v-for="t in g.talents"
                :key="t.id"
                class="talent-checkbox"
                v-model="selectedCombatIds"
                :value="t.id"
                :label="t.tier ? `${t.name} (Tier ${t.tier})` : t.name"
                :messages="[prereqLine(t), t.effectText]"
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

    <template v-if="narrativeCount > 0">
      <div class="text-subtitle-1 mt-4">
        Narrative Talents ({{ selectedNarrativeIds.length }} / {{ narrativeCount }})
      </div>

      <template v-if="narrativeContinuationGroups.length">
        <div class="text-subtitle-2 text-medium-emphasis mt-1 mb-1">Continue a Talent Tree You Already Have</div>
        <div v-for="g in narrativeContinuationGroups" :key="g.groupName" class="mb-3">
          <div class="text-body-1 font-weight-medium">{{ g.groupName }}</div>
          <v-checkbox
            v-for="t in g.talents"
            :key="t.id"
            class="talent-checkbox"
            v-model="selectedNarrativeIds"
            :value="t.id"
            :label="t.name"
            :messages="[prereqLine(t), t.effectText]"
            density="compact"
            hide-details="auto"
            :disabled="
              (!selectedNarrativeIds.includes(t.id) && selectedNarrativeIds.length >= narrativeCount) ||
              !meetsTalentPrerequisites(t.prerequisites, prereqContext)
            "
          />
        </div>
        <v-divider class="mb-3" />
        <div class="text-subtitle-2 text-medium-emphasis mb-1">All Talent Trees</div>
      </template>

      <v-expansion-panels variant="accordion" multiple>
        <v-expansion-panel v-for="section in narrativeSections" :key="section.subgroup" :title="section.subgroup">
          <v-expansion-panel-text>
            <div v-for="g in section.groups" :key="g.groupName" class="mb-3">
              <div class="text-body-1 font-weight-medium">{{ g.groupName }}</div>
              <p v-if="flavorTextByGroupName.get(g.groupName)" class="text-medium-emphasis font-italic text-body-2 mb-1">
                {{ flavorTextByGroupName.get(g.groupName) }}
              </p>
              <v-checkbox
                v-for="t in g.talents"
                :key="t.id"
                class="talent-checkbox"
                v-model="selectedNarrativeIds"
                :value="t.id"
                :label="t.name"
                :messages="[prereqLine(t), t.effectText]"
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
  </div>
</template>

<style scoped>
/* Swapped with the group name above: the group heading now reads larger than the individual
   talent labels beneath it, matching normal heading/list-item hierarchy. */
.talent-checkbox :deep(.v-label) {
  font-size: 14px;
}

/* Each checkbox's :messages array renders as two stacked lines: the prerequisite (kept at
   Vuetify's default hint size) then the rules description, bumped up to 14px for readability.
   Vuetify's default line-height (12px) was sized for the original 12px hint text, so it has to
   be widened too or the bumped-up text reads as cramped/overlapping, especially once it wraps
   to multiple lines. */
.talent-checkbox :deep(.v-messages__message:last-child) {
  font-size: 14px;
  line-height: 1.5;
  margin-top: 4px;
}
</style>
