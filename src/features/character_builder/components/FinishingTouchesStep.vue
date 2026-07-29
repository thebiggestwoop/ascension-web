<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AttributeId, SkillId } from '@/classes/enums'
import { Character, computeStatModifiers } from '@/classes/Character'
import { CoreContent } from '@/io/ContentLoader'
import { useCharacterDraftStore } from '../store/CharacterDraftStore'
import PointAllocator from './PointAllocator.vue'
import EquipmentPicker from './EquipmentPicker.vue'
import TalentPicker from './TalentPicker.vue'

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

/** Reflects cap correction + the allocator's current picks, so the Talent prerequisite check below reacts live. */
const projectedAttributes = computed(() => {
  const result = { ...store.draft.attributes }
  for (const [id, delta] of Object.entries(capCorrection.value.attributeDeltas)) {
    result[id as AttributeId] += delta ?? 0
  }
  for (const id of attributeAllocations.value) {
    if (id) result[id] += 1
  }
  return result
})

const nameText = ref('')
const valueText = ref('')
const definingFeatureText = ref('')

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

const isReady = computed(
  () =>
    nameText.value.trim().length > 0 &&
    attributeAllocations.value.every((v) => v !== null) &&
    skillAllocations.value.every((v) => v !== null) &&
    valueText.value.trim().length > 0 &&
    definingFeatureText.value.trim().length > 0 &&
    talentPicks.value.narrativeTalentIds.length === REQUIRED_NARRATIVE_TALENTS &&
    talentPicks.value.combatTalentIds.length === REQUIRED_COMBAT_TALENTS,
)

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

    <template v-if="!finished">
      <v-card class="mb-4" variant="outlined">
        <v-card-text>
          <div class="text-subtitle-2 mb-1">Attributes</div>
          <p v-if="capCorrection.attributePool > 0" class="text-caption text-medium-emphasis">
            Cap correction freed {{ capCorrection.attributePool }} point(s) from over-cap
            Attributes - combined with your +{{ ATTRIBUTE_BONUS }} bonus points below.
          </p>
          <PointAllocator
            v-model="attributeAllocations"
            :count="attributeAllocatorCount"
            :items="attributeItems"
            label="Choose Attribute"
          />

          <div class="text-subtitle-2 mt-4 mb-1">Skills</div>
          <p v-if="capCorrection.skillPool > 0" class="text-caption text-medium-emphasis">
            Cap correction freed {{ capCorrection.skillPool }} point(s) from over-cap Skills -
            combined with your +{{ SKILL_BONUS }} bonus points below.
          </p>
          <PointAllocator
            v-model="skillAllocations"
            :count="skillAllocatorCount"
            :items="skillItems"
            label="Choose Skill"
          />
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-text>
          <v-text-field v-model="nameText" label="Character Name" density="compact" class="mb-2" />
          <v-text-field v-model="valueText" label="4th Value" density="compact" class="mb-2" />
          <v-text-field v-model="definingFeatureText" label="Defining Feature (Trait)" density="compact" />
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Equipment</v-card-title>
        <v-card-text>
          <EquipmentPicker @change="(p) => (equipmentPicks = p)" />
        </v-card-text>
      </v-card>

      <v-card class="mb-4" variant="outlined">
        <v-card-title>Talents</v-card-title>
        <v-card-text>
          <TalentPicker
            :attributes="projectedAttributes"
            :skills="store.draft.skills"
            :social-class-id="store.draft.socialClassId"
            :career-id="store.draft.careerId"
            @change="(p) => (talentPicks = p)"
          />
        </v-card-text>
      </v-card>

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
