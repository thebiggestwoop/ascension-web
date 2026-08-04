<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AttributeId, SkillId } from '@/classes/enums'
import { Character, computeStatModifiers } from '@/classes/Character'
import { isAllocationDisabledByCeiling } from '@/classes/AllocationCaps'
import { SPELLCASTER_TALENT_IDS, resolveMagickDomainAccess } from '@/classes/Spell'
import { CoreContent } from '@/io/ContentLoader'
import MarkdownText from '@/ui/MarkdownText.vue'
import { useCharacterDraftStore } from '../store/CharacterDraftStore'
import PointAllocator from './PointAllocator.vue'
import EquipmentPicker from './EquipmentPicker.vue'
import TalentPicker from './TalentPicker.vue'
import SpellPicker from '@/features/character_sheet/components/SpellPicker.vue'

const router = useRouter()
const allTalents = [...CoreContent.talents.narrative, ...CoreContent.talents.combat]

const ATTRIBUTE_CAP = 11
const SKILL_CAP = 4
const ATTRIBUTE_BONUS = 3
const SKILL_BONUS = 2
const REQUIRED_NARRATIVE_TALENTS = 3
const REQUIRED_COMBAT_TALENTS = 4

const store = useCharacterDraftStore()
const emit = defineEmits<{ finish: [] }>()

const attributeItems = CoreContent.attributes.map((a) => ({ title: a.name, value: a.id }))
const skillItems = CoreContent.skills.map((s) => ({ title: s.name, value: s.id }))

/**
 * Deterministic cap correction, computed once from the draft as it stands entering this
 * step: any Attribute over 11 (or any Skill over 4) is reduced to the cap, and if more than
 * one sits exactly at the cap the extras are reduced by 1 further. Every point removed this
 * way is added to a pool the player redistributes freely, per the rules text ("for each
 * point reduced from an Attribute, increase another Attribute by one").
 */
const capCorrection = computed(() => {
  const allAttrIds = CoreContent.attributes.map((a) => a.id as AttributeId)
  const attrs = { ...store.draft.attributes }
  const attributeDeltas: Partial<Record<AttributeId, number>> = {}
  let attributePool = 0
  for (const id of allAttrIds) {
    if (attrs[id] > ATTRIBUTE_CAP) {
      const excess = attrs[id] - ATTRIBUTE_CAP
      attributeDeltas[id] = (attributeDeltas[id] ?? 0) - excess
      attrs[id] = ATTRIBUTE_CAP
      attributePool += excess
    }
  }
  for (const id of allAttrIds.filter((i) => attrs[i] === ATTRIBUTE_CAP).slice(1)) {
    attributeDeltas[id] = (attributeDeltas[id] ?? 0) - 1
    attrs[id] -= 1
    attributePool += 1
  }

  const allSkillIds = CoreContent.skills.map((s) => s.id as SkillId)
  const skills = { ...store.draft.skills }
  const skillDeltas: Partial<Record<SkillId, number>> = {}
  let skillPool = 0
  for (const id of allSkillIds) {
    if (skills[id] > SKILL_CAP) {
      const excess = skills[id] - SKILL_CAP
      skillDeltas[id] = (skillDeltas[id] ?? 0) - excess
      skills[id] = SKILL_CAP
      skillPool += excess
    }
  }
  for (const id of allSkillIds.filter((i) => skills[i] === SKILL_CAP).slice(1)) {
    skillDeltas[id] = (skillDeltas[id] ?? 0) - 1
    skills[id] -= 1
    skillPool += 1
  }

  return { attributeDeltas, attributePool, skillDeltas, skillPool }
})

const attributeAllocatorCount = capCorrection.value.attributePool + ATTRIBUTE_BONUS
const skillAllocatorCount = capCorrection.value.skillPool + SKILL_BONUS

const attributeAllocations = ref<(AttributeId | null)[]>(Array(attributeAllocatorCount).fill(null))
const skillAllocations = ref<(SkillId | null)[]>(Array(skillAllocatorCount).fill(null))

const allAttributeIds = CoreContent.attributes.map((a) => a.id as AttributeId)
const allSkillIds = CoreContent.skills.map((s) => s.id as SkillId)

/** Cap correction already brought every Attribute/Skill to at-or-below the cap with at most
 * one at the cap exactly - this is the base the bonus-point allocator's own ceiling check
 * builds on, so those bonus points can't just recreate the overshoot cap correction just fixed. */
const attributesAfterCapCorrection = computed(() => {
  const result = { ...store.draft.attributes }
  for (const [id, delta] of Object.entries(capCorrection.value.attributeDeltas)) {
    result[id as AttributeId] += delta ?? 0
  }
  return result
})
const skillsAfterCapCorrection = computed(() => {
  const result = { ...store.draft.skills }
  for (const [id, delta] of Object.entries(capCorrection.value.skillDeltas)) {
    result[id as SkillId] += delta ?? 0
  }
  return result
})

function isAttributeDisabled(itemValue: string, slotIndex: number): boolean {
  return isAllocationDisabledByCeiling(
    allAttributeIds,
    attributesAfterCapCorrection.value,
    attributeAllocations.value,
    itemValue as AttributeId,
    slotIndex,
    ATTRIBUTE_CAP,
  )
}
function isSkillDisabled(itemValue: string, slotIndex: number): boolean {
  return isAllocationDisabledByCeiling(
    allSkillIds,
    skillsAfterCapCorrection.value,
    skillAllocations.value,
    itemValue as SkillId,
    slotIndex,
    SKILL_CAP,
  )
}

/** Reflects cap correction + the allocator's current picks, so the Talent prerequisite check below reacts live. */
const projectedAttributes = computed(() => {
  const result = { ...attributesAfterCapCorrection.value }
  for (const id of attributeAllocations.value) {
    if (id) result[id] += 1
  }
  return result
})
const projectedSkills = computed(() => {
  const result = { ...skillsAfterCapCorrection.value }
  for (const id of skillAllocations.value) {
    if (id) result[id] += 1
  }
  return result
})

const nameText = ref('')
const valueText = ref('')
const definingFeatureText = ref('')

/** "Focuses in Combat" optional rule: two distinct Skills chosen at creation gain an expanded
 * crit range in combat instead of relying on written Focuses - a third can be added at Level 6. */
const combatFocusSkillA = ref<SkillId | null>(null)
const combatFocusSkillB = ref<SkillId | null>(null)
const combatFocusSkillAItems = computed(() => skillItems.filter((s) => s.value !== combatFocusSkillB.value))
const combatFocusSkillBItems = computed(() => skillItems.filter((s) => s.value !== combatFocusSkillA.value))
const combatSkillFocuses = computed<SkillId[]>(() =>
  [combatFocusSkillA.value, combatFocusSkillB.value].filter((s): s is SkillId => s !== null),
)

const equipmentPicks = ref<{
  equippedWeaponIds: string[]
  equippedArmorId?: string
  inventoryItemIds: string[]
  mountId?: string
}>({ equippedWeaponIds: [], inventoryItemIds: [] })

const talentPicks = ref<{ narrativeTalentIds: string[]; combatTalentIds: string[] }>({
  narrativeTalentIds: [],
  combatTalentIds: [],
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
const preparedSpellIds = ref<string[]>([])
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
  return projectedSkills.value[SkillId.Study] + (modifiers.spellSlotBonus ?? 0)
})

/** Reports this step's in-progress picks to CharacterPreview immediately, rather than only
 * once "Finish Character" is pressed. */
watch(
  [projectedAttributes, projectedSkills, valueText, definingFeatureText, talentPicks],
  () => {
    const traitNames: string[] = []
    if (definingFeatureText.value.trim()) traitNames.push(`Defining Feature: ${definingFeatureText.value}`)
    if (hasSpellcasterTrait.value) traitNames.push('Spellcaster')
    store.setPendingPreview({
      attributes: projectedAttributes.value,
      skills: projectedSkills.value,
      focusTexts: [],
      valueTexts: valueText.value.trim() ? [valueText.value] : [],
      traitNames,
    })
  },
  { deep: true, immediate: true },
)

/**
 * Explicit list of what's still missing, shown next to the Finish button - same treatment as
 * Quick Build's own missingRequirements, since this step has just as many required fields
 * (Attributes/Skills/Combat Focuses/Value/Defining Feature/Talents) and the same "button is
 * silently disabled with no clue why" problem otherwise.
 */
const missingRequirements = computed(() => {
  const missing: string[] = []
  if (!nameText.value.trim()) missing.push('Character Name')
  if (!attributeAllocations.value.every((v) => v !== null)) {
    missing.push(`Assign all ${attributeAllocatorCount} Attribute points`)
  }
  if (!skillAllocations.value.every((v) => v !== null)) {
    missing.push(`Assign all ${skillAllocatorCount} Skill points`)
  }
  if (combatSkillFocuses.value.length !== 2) missing.push('Choose 2 Combat Skill Focuses')
  if (!store.draft.focuses.every((f) => f.trim())) missing.push('Fill in all Focuses')
  if (!store.draft.values.every((v) => v.text.trim())) missing.push('Fill in all Values')
  if (!valueText.value.trim()) missing.push('Fill in your new Value')
  if (!definingFeatureText.value.trim()) missing.push('Fill in Defining Feature')
  if (talentPicks.value.narrativeTalentIds.length !== REQUIRED_NARRATIVE_TALENTS) {
    missing.push(
      `Choose ${REQUIRED_NARRATIVE_TALENTS} Narrative Talents (currently ${talentPicks.value.narrativeTalentIds.length})`,
    )
  }
  if (talentPicks.value.combatTalentIds.length !== REQUIRED_COMBAT_TALENTS) {
    missing.push(
      `Choose ${REQUIRED_COMBAT_TALENTS} Combat Talents (currently ${talentPicks.value.combatTalentIds.length})`,
    )
  }
  return missing
})

const isReady = computed(() => missingRequirements.value.length === 0)

const finished = ref(false)

async function finish() {
  if (!isReady.value || finished.value) return

  const attributeDeltas: Partial<Record<AttributeId, number>> = { ...capCorrection.value.attributeDeltas }
  for (const id of attributeAllocations.value) {
    if (id) attributeDeltas[id] = (attributeDeltas[id] ?? 0) + 1
  }
  const skillDeltas: Partial<Record<SkillId, number>> = { ...capCorrection.value.skillDeltas }
  for (const id of skillAllocations.value) {
    if (id) skillDeltas[id] = (skillDeltas[id] ?? 0) + 1
  }

  await store.applyFinishingTouches({
    name: nameText.value,
    attributeDeltas,
    skillDeltas,
    valueText: valueText.value,
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

  finished.value = true
  emit('finish')
}

/**
 * Deliberately NOT Character.Deserialize()/toRaw(): those strip Vue's reactive Proxy via
 * structuredClone, so this computed would only re-run when `store.draft` is reassigned
 * wholesale, not when mutated in place. Constructing directly over the live proxy keeps
 * every nested read tracked as a real dependency.
 */
const finalCharacter = computed(() => {
  const modifiers = computeStatModifiers(
    store.draft,
    allTalents,
    CoreContent.equipment.armor,
    CoreContent.equipment.general,
  )
  return new Character(store.draft, modifiers)
})
const attributeSum = computed(() => Object.values(store.draft.attributes).reduce((a, b) => a + b, 0))
const skillSum = computed(() => Object.values(store.draft.skills).reduce((a, b) => a + b, 0))
</script>

<template>
  <div>
    <h3 class="text-h6 mb-2">Step Six: Finishing Touches</h3>
    <MarkdownText
      v-if="CoreContent.lifepath.finishingTouches.notes"
      :source="CoreContent.lifepath.finishingTouches.notes"
      class="text-body-2 text-medium-emphasis mb-3"
    />

    <template v-if="!finished">
      <v-card class="mb-4" variant="outlined">
        <v-card-text>
          <div class="text-subtitle-2 mb-1">Attributes</div>
          <p v-if="capCorrection.attributePool > 0" class="text-caption text-medium-emphasis">
            Cap correction freed {{ capCorrection.attributePool }} point(s) from over-cap
            Attributes - combined with your +{{ ATTRIBUTE_BONUS }} bonus points below.
          </p>
          <p class="text-caption text-medium-emphasis">
            Max {{ ATTRIBUTE_CAP }}, only one Attribute may reach it.
          </p>
          <PointAllocator
            v-model="attributeAllocations"
            :count="attributeAllocatorCount"
            :items="attributeItems"
            label="Choose Attribute"
            :is-item-disabled="isAttributeDisabled"
          />

          <div class="text-subtitle-2 mt-4 mb-1">Skills</div>
          <p v-if="capCorrection.skillPool > 0" class="text-caption text-medium-emphasis">
            Cap correction freed {{ capCorrection.skillPool }} point(s) from over-cap Skills -
            combined with your +{{ SKILL_BONUS }} bonus points below.
          </p>
          <p class="text-caption text-medium-emphasis">Max {{ SKILL_CAP }}, only one Skill may reach it.</p>
          <PointAllocator
            v-model="skillAllocations"
            :count="skillAllocatorCount"
            :items="skillItems"
            label="Choose Skill"
            :is-item-disabled="isSkillDisabled"
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

      <v-card class="mb-4" variant="outlined">
        <v-card-text>
          <v-text-field v-model="nameText" label="Character Name" density="compact" class="mb-2" />
          <v-text-field v-model="definingFeatureText" label="Defining Feature (Trait)" density="compact" />
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Focuses &amp; Values</v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis mb-2">
            Pre-filled from your Lifepath choices - edit anything you like. Finishing Touches also grants one new Value.
          </p>
          <v-text-field
            v-for="(_, i) in store.draft.focuses"
            :key="`existing-focus-${i}`"
            v-model="store.draft.focuses[i]"
            :label="`Focus ${i + 1}`"
            density="compact"
            class="mb-1"
          />
          <v-text-field
            v-for="(_, i) in store.draft.values"
            :key="`existing-value-${i}`"
            v-model="store.draft.values[i].text"
            :label="`Value ${i + 1}`"
            density="compact"
            class="mb-1"
          />
          <v-text-field
            v-model="valueText"
            :label="`Value ${store.draft.values.length + 1} (New)`"
            density="compact"
          />
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Talents</v-card-title>
        <v-card-text>
          <TalentPicker
            :attributes="projectedAttributes"
            :skills="projectedSkills"
            :held-trait-names="store.draft.traits.map((t) => t.name)"
            :career-id="store.draft.careerId"
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
            :skirmish-skill="projectedSkills[SkillId.Skirmish]"
            :attributes="projectedAttributes"
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
            :attributes="projectedAttributes"
            :skills="projectedSkills"
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
        <div>Attributes: {{ attributeSum }} (target 56)</div>
        <div>Skills: {{ skillSum }} (target 14)</div>
        <div>Focuses: {{ store.draft.focuses.length }} (target 6)</div>
        <div>Values: {{ store.draft.values.length }} (target 4)</div>
        <div>
          Narrative Talents: {{ talentPicks.narrativeTalentIds.length }} / {{ REQUIRED_NARRATIVE_TALENTS }}
        </div>
        <div>Combat Talents: {{ talentPicks.combatTalentIds.length }} / {{ REQUIRED_COMBAT_TALENTS }}</div>

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
