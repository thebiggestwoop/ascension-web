<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AttributeId, SkillId, SocialClassId } from '@/classes/enums'
import { Character, computeStatModifiers } from '@/classes/Character'
import { isAllocationDisabledByCeiling } from '@/classes/AllocationCaps'
import { CoreContent } from '@/io/ContentLoader'
import { useCharacterDraftStore } from '../store/CharacterDraftStore'
import PointAllocator from './PointAllocator.vue'
import EquipmentPicker from './EquipmentPicker.vue'
import TalentPicker from './TalentPicker.vue'

/**
 * Standard Array character creation: assign fixed Attribute/Skill arrays, add bonus points,
 * then the same Focus/Value/Talent/Trait/Equipment grants as Finishing Touches - all in one
 * step, with no Lifepath stages (so no Social Class/Career, and no Talent prerequisites tied
 * to either can ever be met via this path, matching the rules' own scope for Standard Array).
 */
const sa = CoreContent.standardArray
const router = useRouter()
const store = useCharacterDraftStore()
const emit = defineEmits<{ finish: [] }>()

const allTalents = [...CoreContent.talents.narrative, ...CoreContent.talents.combat]
const allAttributeIds = CoreContent.attributes.map((a) => a.id as AttributeId)
const allSkillIds = CoreContent.skills.map((s) => s.id as SkillId)

/** "Only one Attribute may be equal to 11 at start, and the rest may not exceed 10." */
const ATTRIBUTE_ARRAY_CEILING = 11
/** "Only one Skill may be equal to 4 at start, and the rest may not exceed 3." */
const SKILL_ARRAY_CEILING = 4

const nameText = ref('')

// --- Step One: assign the fixed Attribute array, one value per Attribute (no picking twice
// past the array's own duplicates - it holds two 7s and two 6s). ---
const attributeArrayAssignments = ref<(number | null)[]>(Array(allAttributeIds.length).fill(null))

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
const attributeBonusAllocations = ref<(AttributeId | null)[]>(Array(sa.attributeBonusPoints).fill(null))
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
const skillArrayAssignments = ref<(number | null)[]>(Array(allSkillIds.length).fill(null))

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
const skillBonusAllocations = ref<(SkillId | null)[]>(Array(sa.skillBonusPoints).fill(null))
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

// --- Step Three: Focuses, Values, Trait, Talents ---
const focusTexts = ref<string[]>(Array(sa.focusCount).fill(''))
const valueTexts = ref<string[]>(Array(sa.valueCount).fill(''))

/**
 * The rules just say "Commoner or Noble", but that alone can't unlock the Peasant/Merchant/
 * High Born Narrative Archetypes (their Talents are gated on a `socialClassId` the Lifepath
 * path sets and Quick Build otherwise never has). Offering these three specific flavors
 * instead - each setting the matching socialClassId - lets Quick Build characters reach the
 * same Class Archetypes Lifepath characters can, at the cost of the generic "Commoner/Noble"
 * wording. High Born itself is an OR across three nobility ranks (Talent.ts's
 * `socialClassAny`); Petty Nobility is used as the representative choice.
 */
const CLASS_TRAIT_SOCIAL_CLASS: Record<'Peasant' | 'Merchant' | 'High Born', SocialClassId> = {
  Peasant: SocialClassId.CommonerPeasant,
  Merchant: SocialClassId.CommonerMerchant,
  'High Born': SocialClassId.PettyNobility,
}
const traitChoice = ref<'Peasant' | 'Merchant' | 'High Born' | null>(null)
const selectedSocialClassId = computed(() => (traitChoice.value ? CLASS_TRAIT_SOCIAL_CLASS[traitChoice.value] : undefined))
const definingFeatureText = ref('')

/** Reports this step's in-progress picks to CharacterPreview immediately, rather than only
 * once "Finish Character" is pressed. */
watch(
  [finalAttributes, finalSkills, focusTexts, valueTexts, traitChoice, definingFeatureText],
  () => {
    const traitNames: string[] = []
    if (traitChoice.value) traitNames.push(traitChoice.value)
    if (definingFeatureText.value.trim()) traitNames.push(definingFeatureText.value)
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

const talentPicks = ref<{ narrativeTalentIds: string[]; combatTalentIds: string[] }>({
  narrativeTalentIds: [],
  combatTalentIds: [],
})

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
  if (!focusTexts.value.every((t) => t.trim())) missing.push(`Fill in all ${sa.focusCount} Focuses`)
  if (!valueTexts.value.every((t) => t.trim())) missing.push(`Fill in all ${sa.valueCount} Values`)
  if (!traitChoice.value) missing.push('Choose Peasant, Merchant, or High Born')
  if (!definingFeatureText.value.trim()) missing.push('Fill in Defining Feature')
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
  if (!isReady.value || finished.value || !traitChoice.value) return

  await store.applyQuickBuild({
    name: nameText.value,
    attributes: finalAttributes.value,
    skills: finalSkills.value,
    focusTexts: [...focusTexts.value],
    valueTexts: [...valueTexts.value],
    traitName: traitChoice.value,
    socialClassId: selectedSocialClassId.value,
    definingFeatureText: definingFeatureText.value,
    narrativeTalentIds: talentPicks.value.narrativeTalentIds,
    combatTalentIds: talentPicks.value.combatTalentIds,
    equippedWeaponIds: equipmentPicks.value.equippedWeaponIds,
    equippedArmorId: equipmentPicks.value.equippedArmorId,
    inventoryItemIds: equipmentPicks.value.inventoryItemIds,
    mountId: equipmentPicks.value.mountId,
  })

  finished.value = true
  emit('finish')
}

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
    <h3 class="text-h6 mb-2">Quick Build (Standard Array)</h3>

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
        </v-card-text>
      </v-card>

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
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Traits</v-card-title>
        <v-card-text>
          <v-radio-group v-model="traitChoice" inline density="compact" label="Starting Trait">
            <v-radio label="Peasant" value="Peasant" />
            <v-radio label="Merchant" value="Merchant" />
            <v-radio label="High Born" value="High Born" />
          </v-radio-group>
          <p class="text-caption text-medium-emphasis mb-2">
            Also unlocks the matching Class Archetype (Peasant/Merchant/High Born) Narrative Talents below.
          </p>
          <v-text-field v-model="definingFeatureText" label="Defining Feature (Trait)" density="compact" />
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Equipment</v-card-title>
        <v-card-text>
          <EquipmentPicker
            :talent-ids="[...talentPicks.narrativeTalentIds, ...talentPicks.combatTalentIds]"
            @change="(p) => (equipmentPicks = p)"
          />
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Talents</v-card-title>
        <v-card-text>
          <TalentPicker
            :attributes="finalAttributes"
            :skills="finalSkills"
            :social-class-id="selectedSocialClassId"
            :narrative-count="sa.narrativeTalentGrant"
            :combat-count="sa.combatTalentGrant.count"
            :max-tier="sa.combatTalentGrant.tier"
            @change="(p) => (talentPicks = p)"
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
