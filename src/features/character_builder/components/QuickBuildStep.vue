<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AttributeId, SkillId } from '@/classes/enums'
import { Character, computeStatModifiers } from '@/classes/Character'
import { isAllocationDisabledByCeiling } from '@/classes/AllocationCaps'
import { SPELLCASTER_TALENT_IDS, resolveMagickDomainAccess } from '@/classes/Spell'
import { CoreContent } from '@/io/ContentLoader'
import type { IArchetypeCharacterData } from '@/classes/Archetype'
import { useCharacterDraftStore } from '../store/CharacterDraftStore'
import PointAllocator from './PointAllocator.vue'
import EquipmentPicker from './EquipmentPicker.vue'
import TalentPicker from './TalentPicker.vue'
import SpellPicker from '@/features/character_sheet/components/SpellPicker.vue'

/**
 * Standard Array character creation: assign fixed Attribute/Skill arrays, add bonus points,
 * then the same Focus/Value/Talent/Trait/Equipment grants as Finishing Touches - all in one
 * step, with no Lifepath stages (so no Social Class/Career, and no Talent prerequisites tied
 * to either can ever be met via this path, matching the rules' own scope for Standard Array).
 *
 * Also doubles as "Start from an Archetype"'s Step Three ("Finishing Touches"): when `prefill`
 * is set (an Archetype pregen), Attributes, Skills, Combat Focuses, Talents, and Equipment/
 * Spells are all pre-populated from its `creationRecord.quickBuild` record, identical to what a
 * player choosing those same options by hand would produce. With `archetypeFinishingTouchesOnly`
 * additionally set, the Focuses/Values/Traits card is hidden entirely (Step Two already applied
 * them, via Lifepath or Quick Entry) and finishing calls applyArchetypeFinishingTouches instead
 * of applyQuickBuild; Character Name is always left for the player to type, in both modes.
 */
const props = defineProps<{
  prefill?: IArchetypeCharacterData
  archetypeFinishingTouchesOnly?: boolean
  /** The Archetype catalog id (e.g. "hero") - recorded into creationRecord.archetype.archetypeId. */
  archetypeId?: string
}>()
const prefillRecord = props.prefill?.creationRecord?.quickBuild

const sa = CoreContent.standardArray
const router = useRouter()
const store = useCharacterDraftStore()
const emit = defineEmits<{ finish: [] }>()

const allTalents = [...CoreContent.talents.narrative, ...CoreContent.talents.combat]
const allSpells = [...CoreContent.spells.arcane, ...CoreContent.spells.light, ...CoreContent.spells.dark]
const allAttributeIds = CoreContent.attributes.map((a) => a.id as AttributeId)
const allSkillIds = CoreContent.skills.map((s) => s.id as SkillId)

/** "Only one Attribute may be equal to 11 at start, and the rest may not exceed 10." */
const ATTRIBUTE_ARRAY_CEILING = 11
/** "Only one Skill may be equal to 4 at start, and the rest may not exceed 3." */
const SKILL_ARRAY_CEILING = 4

/**
 * Reverse-engineers a Standard Array "array slot + bonus points" allocation that reproduces a
 * set of already-authored final values - lets an Archetype's final Attributes/Skills prefill
 * this form's array-assignment selects instead of just the totals. Assigns each (sorted-
 * descending) final value the largest remaining array value that still fits under it; this
 * greedy exchange always finds a valid decomposition when one exists, and one always exists
 * here since every Archetype is authored to fit within this same array + bonus points scheme
 * (its final values sum to the same target the array + bonus points sum to).
 */
function decomposeArray(
  finalValues: number[],
  arrayValues: number[],
  bonusPoints: number,
): { arraySlots: number[]; bonusPerIndex: number[] } | null {
  const order = finalValues.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
  const remaining = [...arrayValues].sort((a, b) => b - a)
  const arraySlots: number[] = Array(finalValues.length).fill(0)
  const bonusPerIndex: number[] = Array(finalValues.length).fill(0)
  for (const { v, i } of order) {
    const pickIdx = remaining.findIndex((val) => val <= v)
    if (pickIdx === -1) return null
    const picked = remaining.splice(pickIdx, 1)[0]
    arraySlots[i] = picked
    bonusPerIndex[i] = v - picked
  }
  if (bonusPerIndex.reduce((a, b) => a + b, 0) !== bonusPoints) return null
  return { arraySlots, bonusPerIndex }
}

/** Expands a per-attribute/skill bonus count (e.g. Reason +2, Agility +1) into the flat list of
 * "which id gets the next bonus point" slots that PointAllocator's v-model expects. */
function bonusPerIndexToSlots<T>(bonusPerIndex: number[], ids: T[], slotCount: number): (T | null)[] {
  const slots: (T | null)[] = []
  bonusPerIndex.forEach((count, idx) => {
    for (let k = 0; k < count; k++) slots.push(ids[idx])
  })
  while (slots.length < slotCount) slots.push(null)
  return slots
}

const nameText = ref('')

const attributeDecomposition = prefillRecord
  ? decomposeArray(allAttributeIds.map((id) => prefillRecord.attributes[id]), sa.attributeArray, sa.attributeBonusPoints)
  : null
const skillDecomposition = prefillRecord
  ? decomposeArray(allSkillIds.map((id) => prefillRecord.skills[id]), sa.skillArray, sa.skillBonusPoints)
  : null

// --- Step One: assign the fixed Attribute array, one value per Attribute (no picking twice
// past the array's own duplicates - it holds two 7s and two 6s). ---
const attributeArrayAssignments = ref<(number | null)[]>(
  attributeDecomposition ? [...attributeDecomposition.arraySlots] : Array(allAttributeIds.length).fill(null),
)

function remainingArrayCounts(array: number[], assignments: (number | null)[], excludeIndex: number): Map<number, number> {
  const counts = new Map<number, number>()
  for (const v of array) counts.set(v, (counts.get(v) ?? 0) + 1)
  assignments.forEach((val, idx) => {
    if (idx !== excludeIndex && val !== null) counts.set(val, (counts.get(val) ?? 0) - 1)
  })
  return counts
}

function attributeArrayItemsForSlot(slotIndex: number) {
  const counts = remainingArrayCounts(sa.attributeArray, attributeArrayAssignments.value, slotIndex)
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([v]) => ({ title: String(v), value: v }))
    .sort((a, b) => b.value - a.value)
}

const attributeArrayComplete = computed(() => attributeArrayAssignments.value.every((v) => v !== null))

const baseAttributes = computed<Record<AttributeId, number>>(() => {
  const result = {} as Record<AttributeId, number>
  allAttributeIds.forEach((id, idx) => {
    result[id] = attributeArrayAssignments.value[idx] ?? 6
  })
  return result
})

// --- Attribute bonus points (+3, freely split, capped so only one Attribute reaches 11) ---
const attributeBonusAllocations = ref<(AttributeId | null)[]>(
  attributeDecomposition
    ? bonusPerIndexToSlots(attributeDecomposition.bonusPerIndex, allAttributeIds, sa.attributeBonusPoints)
    : Array(sa.attributeBonusPoints).fill(null),
)
const attributeItems = CoreContent.attributes.map((a) => ({ title: a.name, value: a.id }))

function isAttributeBonusDisabled(itemValue: string, slotIndex: number): boolean {
  return isAllocationDisabledByCeiling(
    allAttributeIds,
    baseAttributes.value,
    attributeBonusAllocations.value,
    itemValue as AttributeId,
    slotIndex,
    ATTRIBUTE_ARRAY_CEILING,
  )
}

const finalAttributes = computed<Record<AttributeId, number>>(() => {
  const result = { ...baseAttributes.value }
  for (const id of attributeBonusAllocations.value) {
    if (id) result[id] += 1
  }
  return result
})

// --- Step Two: assign the fixed Skill array ---
const skillArrayAssignments = ref<(number | null)[]>(
  skillDecomposition ? [...skillDecomposition.arraySlots] : Array(allSkillIds.length).fill(null),
)

function skillArrayItemsForSlot(slotIndex: number) {
  const counts = remainingArrayCounts(sa.skillArray, skillArrayAssignments.value, slotIndex)
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([v]) => ({ title: String(v), value: v }))
    .sort((a, b) => b.value - a.value)
}

const skillArrayComplete = computed(() => skillArrayAssignments.value.every((v) => v !== null))

const baseSkills = computed<Record<SkillId, number>>(() => {
  const result = {} as Record<SkillId, number>
  allSkillIds.forEach((id, idx) => {
    result[id] = skillArrayAssignments.value[idx] ?? 1
  })
  return result
})

// --- Skill bonus points (+2, freely split, capped so only one Skill reaches 4) ---
const skillBonusAllocations = ref<(SkillId | null)[]>(
  skillDecomposition
    ? bonusPerIndexToSlots(skillDecomposition.bonusPerIndex, allSkillIds, sa.skillBonusPoints)
    : Array(sa.skillBonusPoints).fill(null),
)
const skillItems = CoreContent.skills.map((s) => ({ title: s.name, value: s.id }))

function isSkillBonusDisabled(itemValue: string, slotIndex: number): boolean {
  return isAllocationDisabledByCeiling(
    allSkillIds,
    baseSkills.value,
    skillBonusAllocations.value,
    itemValue as SkillId,
    slotIndex,
    SKILL_ARRAY_CEILING,
  )
}

const finalSkills = computed<Record<SkillId, number>>(() => {
  const result = { ...baseSkills.value }
  for (const id of skillBonusAllocations.value) {
    if (id) result[id] += 1
  }
  return result
})

/** "Focuses in Combat" optional rule: two distinct Skills chosen at creation gain an expanded
 * crit range in combat instead of relying on written Focuses - a third can be added at Level 6. */
const combatFocusSkillA = ref<SkillId | null>(prefillRecord?.combatSkillFocuses[0] ?? null)
const combatFocusSkillB = ref<SkillId | null>(prefillRecord?.combatSkillFocuses[1] ?? null)
const combatFocusSkillAItems = computed(() => skillItems.filter((s) => s.value !== combatFocusSkillB.value))
const combatFocusSkillBItems = computed(() => skillItems.filter((s) => s.value !== combatFocusSkillA.value))
const combatSkillFocuses = computed<SkillId[]>(() =>
  [combatFocusSkillA.value, combatFocusSkillB.value].filter((s): s is SkillId => s !== null),
)

// --- Step Three: Focuses, Values, Trait, Talents ---
const focusTexts = ref<string[]>(Array(sa.focusCount).fill(''))
const valueTexts = ref<string[]>(Array(sa.valueCount).fill(''))
/** "I'll add these later." - lets the player finish without writing any Focus/Value text now;
 * whatever they did type is still kept (blanks are dropped), same as leaving the field alone. */
const skipFocusesValues = ref(false)

/**
 * Each Social Class choice grants the same Traits the matching Lifepath Social Class option
 * would: Peasant/Merchant grant a general "Commoner" Trait plus their specific rank, Noble
 * grants only the general "Noble" Trait (nothing more specific) - see social-classes.json.
 * Narrative Talents gated on Social Class check these same Trait names (Talent.ts's `trait`
 * prerequisite), so a Quick Build character reaches the same Class Archetypes a Lifepath
 * character can.
 */
const CLASS_TRAIT_NAMES: Record<'Peasant' | 'Merchant' | 'Noble', string[]> = {
  Peasant: ['Commoner', 'Peasant'],
  Merchant: ['Commoner', 'Merchant'],
  Noble: ['Noble'],
}

function inferTraitChoice(traitNames: string[] | undefined): 'Peasant' | 'Merchant' | 'Noble' | null {
  if (!traitNames) return null
  for (const choice of Object.keys(CLASS_TRAIT_NAMES) as ('Peasant' | 'Merchant' | 'Noble')[]) {
    const names = CLASS_TRAIT_NAMES[choice]
    if (names.length === traitNames.length && names.every((n) => traitNames.includes(n))) return choice
  }
  return null
}
const traitChoice = ref<'Peasant' | 'Merchant' | 'Noble' | null>(inferTraitChoice(prefillRecord?.traitNames))
const classTraitNames = computed(() => (traitChoice.value ? CLASS_TRAIT_NAMES[traitChoice.value] : []))
const definingFeatureText = ref('')

/** In archetypeFinishingTouchesOnly mode, Traits (Class Archetype gates included) were already
 * applied to store.draft in Step Two (Lifepath or Quick Entry) - the local traitChoice/
 * classTraitNames above stay unused (that card is hidden), so Talent prerequisite checks need
 * to read the real Trait names from the draft instead. */
const heldTraitNamesForPicker = computed(() =>
  props.archetypeFinishingTouchesOnly ? store.draft.traits.map((t) => t.name) : classTraitNames.value,
)

const talentPicks = ref<{ narrativeTalentIds: string[]; combatTalentIds: string[] }>({
  narrativeTalentIds: prefillRecord ? [...prefillRecord.narrativeTalentIds] : [],
  combatTalentIds: prefillRecord ? [...prefillRecord.combatTalentIds] : [],
})

/** True the moment a Tier 1 Magick Domain Talent is picked - same Trait every other
 * Spellcaster check keys off, shown live here just like every other pending Trait. */
const hasSpellcasterTrait = computed(() =>
  talentPicks.value.combatTalentIds.some((id) => SPELLCASTER_TALENT_IDS.includes(id)),
)
/** Changes only when the accessible domain/tier set actually changes - keys the Spells card's
 * SpellPicker so it remounts (and re-reads its now-non-reactive domain access) only when it
 * needs to, not on every unrelated Talent pick. */
const spellcasterDomainsKey = computed(() =>
  resolveMagickDomainAccess([...talentPicks.value.narrativeTalentIds, ...talentPicks.value.combatTalentIds])
    .map((d) => `${d.domain}:${d.maxTier}`)
    .join(','),
)
const preparedSpellIds = ref<string[]>(props.prefill ? [...props.prefill.preparedSpellIds] : [])
/** Mirrors Character.spellSlots' own formula (Study + Tome bonus) against the in-progress,
 * not-yet-applied-to-draft picks, since store.draft has no Talents/Equipment until Finish. */
const previewSpellSlots = computed(() => {
  const modifiers = computeStatModifiers(
    {
      talentIds: [...talentPicks.value.narrativeTalentIds, ...talentPicks.value.combatTalentIds],
      equippedArmorId: equipmentPicks.value.equippedArmorId,
      inventoryItemIds: equipmentPicks.value.inventoryItemIds,
    },
    allTalents,
    CoreContent.equipment.armor,
    CoreContent.equipment.general,
  )
  return finalSkills.value[SkillId.Study] + (modifiers.spellSlotBonus ?? 0)
})

/** Reports this step's in-progress picks to CharacterPreview immediately, rather than only
 * once "Finish Character" is pressed. */
watch(
  [finalAttributes, finalSkills, focusTexts, valueTexts, traitChoice, definingFeatureText, talentPicks],
  () => {
    const traitNames: string[] = [...classTraitNames.value]
    if (definingFeatureText.value.trim()) traitNames.push(`Defining Feature: ${definingFeatureText.value}`)
    if (hasSpellcasterTrait.value) traitNames.push('Spellcaster')
    store.setPendingPreview({
      attributes: finalAttributes.value,
      skills: finalSkills.value,
      focusTexts: focusTexts.value,
      valueTexts: valueTexts.value,
      traitNames,
    })
  },
  { deep: true, immediate: true },
)

// --- Step Four: Equipment ---
const equipmentPicks = ref<{
  equippedWeaponIds: string[]
  equippedArmorId?: string
  inventoryItemIds: string[]
  mountId?: string
}>({ equippedWeaponIds: [], inventoryItemIds: [] })

/**
 * Explicit list of what's still missing, shown next to the Finish button. With ~29 required
 * fields across this one step and no per-section "done" indicator, a single missed field
 * (e.g. one of 6 Focuses) left the button silently disabled with no clue why - this makes
 * the reason visible instead of "nothing happens" when clicked.
 */
const missingRequirements = computed(() => {
  const missing: string[] = []
  if (!nameText.value.trim()) missing.push('Character Name')
  if (!attributeArrayComplete.value) missing.push('Assign all 7 Attributes from the array')
  if (!attributeBonusAllocations.value.every((v) => v !== null)) {
    missing.push(`Assign all ${sa.attributeBonusPoints} Attribute bonus points`)
  }
  if (!skillArrayComplete.value) missing.push('Assign all 6 Skills from the array')
  if (!skillBonusAllocations.value.every((v) => v !== null)) {
    missing.push(`Assign all ${sa.skillBonusPoints} Skill bonus points`)
  }
  if (combatSkillFocuses.value.length !== 2) missing.push('Choose 2 Combat Skill Focuses')
  if (!props.archetypeFinishingTouchesOnly) {
    if (!skipFocusesValues.value) {
      if (!focusTexts.value.every((t) => t.trim())) missing.push(`Fill in all ${sa.focusCount} Focuses`)
      if (!valueTexts.value.every((t) => t.trim())) missing.push(`Fill in all ${sa.valueCount} Values`)
    }
    if (!traitChoice.value) missing.push('Choose Peasant, Merchant, or Noble')
    if (!definingFeatureText.value.trim()) missing.push('Fill in Defining Feature')
  }
  if (talentPicks.value.narrativeTalentIds.length !== sa.narrativeTalentGrant) {
    missing.push(
      `Choose ${sa.narrativeTalentGrant} Narrative Talents (currently ${talentPicks.value.narrativeTalentIds.length})`,
    )
  }
  if (talentPicks.value.combatTalentIds.length !== sa.combatTalentGrant.count) {
    missing.push(`Choose ${sa.combatTalentGrant.count} Combat Talents (currently ${talentPicks.value.combatTalentIds.length})`)
  }
  return missing
})

const isReady = computed(() => missingRequirements.value.length === 0)

const finished = ref(false)

async function finish() {
  if (!isReady.value || finished.value) return

  if (props.archetypeFinishingTouchesOnly) {
    await store.applyArchetypeFinishingTouches({
      name: nameText.value,
      archetypeId: props.archetypeId ?? '',
      attributes: finalAttributes.value,
      skills: finalSkills.value,
      narrativeTalentIds: talentPicks.value.narrativeTalentIds,
      combatTalentIds: talentPicks.value.combatTalentIds,
      equippedWeaponIds: equipmentPicks.value.equippedWeaponIds,
      equippedArmorId: equipmentPicks.value.equippedArmorId,
      inventoryItemIds: equipmentPicks.value.inventoryItemIds,
      mountId: equipmentPicks.value.mountId,
      preparedSpellIds: [...preparedSpellIds.value],
      combatSkillFocuses: [...combatSkillFocuses.value],
    })
  } else {
    if (!traitChoice.value) return
    await store.applyQuickBuild({
      name: nameText.value,
      attributes: finalAttributes.value,
      skills: finalSkills.value,
      focusTexts: focusTexts.value.filter((t) => t.trim()),
      valueTexts: valueTexts.value.filter((t) => t.trim()),
      traitNames: classTraitNames.value,
      definingFeatureText: definingFeatureText.value,
      narrativeTalentIds: talentPicks.value.narrativeTalentIds,
      combatTalentIds: talentPicks.value.combatTalentIds,
      equippedWeaponIds: equipmentPicks.value.equippedWeaponIds,
      equippedArmorId: equipmentPicks.value.equippedArmorId,
      inventoryItemIds: equipmentPicks.value.inventoryItemIds,
      mountId: equipmentPicks.value.mountId,
      preparedSpellIds: [...preparedSpellIds.value],
      combatSkillFocuses: [...combatSkillFocuses.value],
    })
  }

  finished.value = true
  emit('finish')
}

const finalCharacter = computed(() => {
  const modifiers = computeStatModifiers(
    store.draft,
    allTalents,
    CoreContent.equipment.armor,
    CoreContent.equipment.general,
    allSpells,
    CoreContent.equipment.shields,
  )
  return new Character(store.draft, modifiers)
})
const attributeSum = computed(() => Object.values(store.draft.attributes).reduce((a, b) => a + b, 0))
const skillSum = computed(() => Object.values(store.draft.skills).reduce((a, b) => a + b, 0))
</script>

<template>
  <div>
    <h3 class="text-h6 mb-2">
      {{ archetypeFinishingTouchesOnly ? 'Finishing Touches' : prefill ? `${prefill.name} (Archetype)` : 'Quick Build (Standard Array)' }}
    </h3>
    <p v-if="archetypeFinishingTouchesOnly" class="text-body-2 text-medium-emphasis mb-2">
      Pre-filled from {{ prefill?.name }} - change anything you like, then name your character to finish.
    </p>
    <p v-else-if="prefill" class="text-body-2 text-medium-emphasis mb-2">
      Everything below is pre-filled from this Archetype - change anything you like before finishing.
    </p>

    <template v-if="!finished">
      <v-card class="mb-4" variant="outlined">
        <v-card-text>
          <v-text-field v-model="nameText" label="Character Name" density="compact" />
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Attributes</v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis">
            Assign {{ sa.attributeArray.join(', ') }} to your Attributes in any order.
          </p>
          <v-select
            v-for="(attr, idx) in CoreContent.attributes"
            :key="attr.id"
            v-model="attributeArrayAssignments[idx]"
            :items="attributeArrayItemsForSlot(idx)"
            :label="attr.name"
            density="compact"
            class="mb-2"
            clearable
          />
          <p class="text-caption text-medium-emphasis mt-2">
            Then +{{ sa.attributeBonusPoints }} bonus points, freely split (max {{ ATTRIBUTE_ARRAY_CEILING }}, only
            one Attribute may reach it).
          </p>
          <PointAllocator
            v-model="attributeBonusAllocations"
            :count="sa.attributeBonusPoints"
            :items="attributeItems"
            label="Choose Attribute"
            :is-item-disabled="isAttributeBonusDisabled"
          />
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Skills</v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis">Assign {{ sa.skillArray.join(', ') }} to your Skills in any order.</p>
          <v-select
            v-for="(skill, idx) in CoreContent.skills"
            :key="skill.id"
            v-model="skillArrayAssignments[idx]"
            :items="skillArrayItemsForSlot(idx)"
            :label="skill.name"
            density="compact"
            class="mb-2"
            clearable
          />
          <p class="text-caption text-medium-emphasis mt-2">
            Then +{{ sa.skillBonusPoints }} bonus points, freely split (max {{ SKILL_ARRAY_CEILING }}, only one Skill
            may reach it).
          </p>
          <PointAllocator
            v-model="skillBonusAllocations"
            :count="sa.skillBonusPoints"
            :items="skillItems"
            label="Choose Skill"
            :is-item-disabled="isSkillBonusDisabled"
          />

          <div class="text-subtitle-2 mt-4 mb-1">Combat Skill Focuses</div>
          <p class="text-caption text-medium-emphasis mb-2">
            Choose 2 different Skills to specialize in for combat - gains an expanded crit range
            on Tasks using that Skill in combat. A third can be added at Level 6.
          </p>
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select v-model="combatFocusSkillA" :items="combatFocusSkillAItems" label="Combat Focus 1" density="compact" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select v-model="combatFocusSkillB" :items="combatFocusSkillBItems" label="Combat Focus 2" density="compact" />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <template v-if="!archetypeFinishingTouchesOnly">
        <v-card class="mb-4" variant="outlined">
          <v-card-title>Focuses &amp; Values</v-card-title>
          <v-card-text>
            <v-text-field
              v-for="(_, i) in focusTexts"
              :key="`focus-${i}`"
              v-model="focusTexts[i]"
              :label="`Focus ${i + 1}`"
              density="compact"
            />
            <v-text-field
              v-for="(_, i) in valueTexts"
              :key="`value-${i}`"
              v-model="valueTexts[i]"
              :label="`Value ${i + 1}`"
              density="compact"
            />
            <v-checkbox
              v-model="skipFocusesValues"
              label="I'll add these later."
              density="compact"
              hide-details
              class="skip-checkbox mt-1"
            />
          </v-card-text>
        </v-card>

        <v-card class="mb-4" variant="outlined">
          <v-card-title>Traits</v-card-title>
          <v-card-text>
            <v-radio-group v-model="traitChoice" inline density="compact" label="Starting Trait">
              <v-radio label="Peasant" value="Peasant" />
              <v-radio label="Merchant" value="Merchant" />
              <v-radio label="Noble" value="Noble" />
            </v-radio-group>
            <p class="text-caption text-medium-emphasis mb-2">
              Also unlocks the matching Class Archetype (Peasant/Merchant/Noble) Narrative Talents below.
            </p>
            <v-text-field v-model="definingFeatureText" label="Defining Feature (Trait)" density="compact" />
          </v-card-text>
        </v-card>
      </template>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Talents</v-card-title>
        <v-card-text>
          <TalentPicker
            :attributes="finalAttributes"
            :skills="finalSkills"
            :held-trait-names="heldTraitNamesForPicker"
            :narrative-count="sa.narrativeTalentGrant"
            :combat-count="sa.combatTalentGrant.count"
            :max-tier="sa.combatTalentGrant.tier"
            :initial-narrative-talent-ids="prefillRecord?.narrativeTalentIds ?? []"
            :initial-combat-talent-ids="prefillRecord?.combatTalentIds ?? []"
            @change="(p) => (talentPicks = p)"
          />
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Equipment</v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis mb-2">
            You can adjust your equipment later from the Character Sheet.
          </p>
          <EquipmentPicker
            :talent-ids="[...talentPicks.narrativeTalentIds, ...talentPicks.combatTalentIds]"
            :skirmish-skill="finalSkills[SkillId.Skirmish]"
            :attributes="finalAttributes"
            :initial-equipped-weapon-ids="prefillRecord?.equippedWeaponIds ?? []"
            :initial-equipped-armor-id="prefillRecord?.equippedArmorId"
            :initial-inventory-item-ids="prefillRecord?.inventoryItemIds ?? []"
            :initial-mount-id="prefillRecord?.mountId"
            @change="(p) => (equipmentPicks = p)"
          />
        </v-card-text>
      </v-card>

      <v-card v-if="hasSpellcasterTrait" class="mb-4" variant="outlined">
        <v-card-title>Spells</v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis mb-2">
            You can adjust your prepared spells later from the Character Sheet.
          </p>
          <SpellPicker
            :key="spellcasterDomainsKey"
            :talent-ids="[...talentPicks.narrativeTalentIds, ...talentPicks.combatTalentIds]"
            :initial-prepared-spell-ids="preparedSpellIds"
            :spell-slots="previewSpellSlots"
            :attributes="finalAttributes"
            :skills="finalSkills"
            @change="(ids) => (preparedSpellIds = [...ids])"
          />
        </v-card-text>
      </v-card>

      <v-alert v-if="missingRequirements.length" type="warning" variant="tonal" density="compact" class="mb-3">
        <div class="text-subtitle-2 mb-1">Still needed before finishing:</div>
        <ul>
          <li v-for="(m, i) in missingRequirements" :key="i">{{ m }}</li>
        </ul>
      </v-alert>

      <v-btn color="primary" :disabled="!isReady" @click="finish">Finish Character</v-btn>
    </template>

    <v-card v-else variant="outlined">
      <v-card-title>Final Scores</v-card-title>
      <v-card-text>
        <div>Attributes: {{ attributeSum }} (target {{ sa.finalCheck.attributeSum }})</div>
        <div>Skills: {{ skillSum }} (target {{ sa.finalCheck.skillSum }})</div>
        <div>Focuses: {{ store.draft.focuses.length }} (target {{ sa.focusCount }})</div>
        <div>Values: {{ store.draft.values.length }} (target {{ sa.valueCount }})</div>
        <div>Narrative Talents: {{ talentPicks.narrativeTalentIds.length }} / {{ sa.narrativeTalentGrant }}</div>
        <div>Combat Talents: {{ talentPicks.combatTalentIds.length }} / {{ sa.combatTalentGrant.count }}</div>

        <div class="text-subtitle-2 mt-4 mb-1">Derived Stats</div>
        <div>Speed: {{ finalCharacter.speed }}</div>
        <div>Max HP: {{ finalCharacter.maxHp }}</div>
        <div>Willpower: {{ finalCharacter.maxWillpower }}</div>
        <div>Resistance: {{ finalCharacter.resistance }}</div>
        <div>Damage Bonus: {{ finalCharacter.damageBonus }}</div>
        <div>Spell Slots: {{ finalCharacter.spellSlots }}</div>
        <div>
          Effect Saves:
          <span v-for="attr in CoreContent.attributes" :key="attr.id" class="mr-2">
            {{ attr.name }}: {{ finalCharacter.effectSave(attr.id) }}
          </span>
        </div>

        <v-btn color="primary" class="mt-4" @click="router.push(`/sheet/${store.draft.id}`)">
          View Character Sheet
        </v-btn>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.skip-checkbox :deep(.v-label) {
  font-size: 0.8rem;
}
</style>
