<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { AttributeId, SkillId } from '@/classes/enums'
import { resolveMagickDomainAccess, MAGICK_ATTRIBUTE_BY_DOMAIN } from '@/classes/Spell'
import type { ActionType, ISpellData, MagickDomain } from '@/classes/Spell'
import type { ICharacterStatSource } from '@/classes/Character'
import QuantityStepper from '@/ui/QuantityStepper.vue'
import DerivedValueBadge from '@/ui/DerivedValueBadge.vue'
import SpellEffectText from './SpellEffectText.vue'

/**
 * Shared by the character builder (Quick Build/Finishing Touches, both creation paths) and
 * the Character Sheet's "Edit Spells" dialog - same rich card presentation as SpellsSection.vue
 * (the sheet's read-only prepared-spells display), just with a QuantityStepper on each card
 * instead of only showing what's already prepared.
 */
const props = defineProps<{
  talentIds: string[]
  initialPreparedSpellIds: string[]
  spellSlots: number
  attributes: Record<AttributeId, number>
  skills: Record<SkillId, number>
}>()
const emit = defineEmits<{ change: [ids: string[]] }>()

const domainAccess = resolveMagickDomainAccess(props.talentIds)

const domainSpells: Record<MagickDomain, ISpellData[]> = {
  arcane: CoreContent.spells.arcane,
  light: CoreContent.spells.light,
  dark: CoreContent.spells.dark,
}
const allSpells = [...CoreContent.spells.arcane, ...CoreContent.spells.light, ...CoreContent.spells.dark]

/**
 * A freshly-built character has no HP loss yet, so `wounds` is always 0 here - avoids needing
 * a fake full ICharacterData just to construct a real Character for SpellEffectText's per-Wound
 * computed-value math (e.g. Penumbra's damage scaling).
 */
const statSource = computed<ICharacterStatSource>(() => ({
  attribute: (id) => props.attributes[id],
  skill: (id) => props.skills[id],
  wounds: 0,
}))

function attributeName(spell: ISpellData): string {
  const attrId = MAGICK_ATTRIBUTE_BY_DOMAIN[spell.domain]
  return CoreContent.attributes.find((a) => a.id === attrId)?.name ?? attrId
}
function skillName(id: SkillId): string {
  return CoreContent.skills.find((s) => s.id === id)?.name ?? id
}
/** Only Attack-tagged (or otherwise task-bearing) spells have a Task at all - see ISpellTask's
 * own doc comment on why some spells omit it entirely. */
function taskValue(spell: ISpellData): number {
  const attrId = MAGICK_ATTRIBUTE_BY_DOMAIN[spell.domain]
  return props.attributes[attrId] + props.skills[spell.task!.skill]
}
function taskTooltip(spell: ISpellData): string {
  const attrId = MAGICK_ATTRIBUTE_BY_DOMAIN[spell.domain]
  return `${attributeName(spell)} ${props.attributes[attrId]}, ${skillName(spell.task!.skill)} +${props.skills[spell.task!.skill]}`
}
function usesDisplay(spell: ISpellData, count: number): string {
  if (spell.usesPerScene === 'passive') return 'Passive'
  return `${spell.usesPerScene * Math.max(1, count)} / scene`
}

const ACTION_LABELS: Record<ActionType, string> = {
  major: 'Major Action',
  minor: 'Minor Action',
  reaction: 'Reaction',
  passive: 'Passive',
}
function actionLabel(action: ActionType): string {
  return ACTION_LABELS[action]
}

function countOccurrences(ids: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1
  return counts
}

const preparedCounts = ref<Record<string, number>>(countOccurrences(props.initialPreparedSpellIds))

function slotsUsedExcept(excludeId?: string): number {
  let used = 0
  for (const [id, count] of Object.entries(preparedCounts.value)) {
    if (id === excludeId) continue
    const spell = allSpells.find((s) => s.id === id)
    if (spell) used += spell.slotCost * count
  }
  return used
}

const totalSlotsUsed = () => slotsUsedExcept(undefined)

/**
 * Highest count `spell` could reach without pushing total prepared slots past the character's
 * Spell Slots. `otherSlotsUsed` already excludes this spell's own current contribution, so the
 * remaining budget divided by its slot cost IS the max directly - adding `current` on top would
 * double-count this spell's existing slots and let the total silently exceed Spell Slots.
 */
function maxCountFor(spell: ISpellData): number {
  const otherSlotsUsed = slotsUsedExcept(spell.id)
  return Math.floor((props.spellSlots - otherSlotsUsed) / spell.slotCost)
}

function setCount(id: string, value: number) {
  preparedCounts.value = { ...preparedCounts.value, [id]: value }
}

watch(
  preparedCounts,
  () => {
    const ids: string[] = []
    for (const [spellId, count] of Object.entries(preparedCounts.value)) {
      for (let i = 0; i < count; i++) ids.push(spellId)
    }
    emit('change', ids)
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <div v-if="domainAccess.length">
    <div class="text-body-2 mb-2">Spell Slots used: {{ totalSlotsUsed() }} / {{ spellSlots }}</div>
    <v-alert v-if="totalSlotsUsed() > spellSlots" type="warning" variant="tonal" density="compact" class="mb-3">
      Over your {{ spellSlots }} Spell Slots by {{ totalSlotsUsed() - spellSlots }} - unprepare something before finishing.
    </v-alert>
    <div v-for="access in domainAccess" :key="access.domain">
      <div class="text-subtitle-2 text-capitalize mt-2 mb-1">{{ access.domain }} (up to Tier {{ access.maxTier }})</div>

      <v-card
        v-for="spell in domainSpells[access.domain].filter((s) => s.tier <= access.maxTier)"
        :key="spell.id"
        variant="outlined"
        class="mb-2"
      >
        <v-card-title class="text-subtitle-1 d-flex align-center justify-space-between flex-wrap ga-1">
          <span>{{ spell.name }}</span>
          <div class="d-flex ga-1">
            <v-chip size="small" variant="tonal">{{ actionLabel(spell.action) }}</v-chip>
            <v-chip size="small">Tier {{ spell.tier }}</v-chip>
          </div>
        </v-card-title>
        <v-card-subtitle>
          {{ spell.tags.join(', ') }} - {{ spell.slotCost }} Slot{{ spell.slotCost > 1 ? 's' : '' }}
          <span v-if="spell.range"> - Range {{ spell.range }}</span>
          <span v-if="spell.willpowerCost"> - {{ spell.willpowerCost }} Willpower</span>
        </v-card-subtitle>
        <v-card-text>
          <div class="d-flex align-center flex-wrap ga-3 mb-2">
            <QuantityStepper
              :model-value="preparedCounts[spell.id] ?? 0"
              :max="maxCountFor(spell)"
              @update:model-value="(v) => setCount(spell.id, v)"
            />
            <span v-if="spell.task">
              Task: {{ attributeName(spell) }}
              <DerivedValueBadge :display="String(taskValue(spell))" :tooltip="taskTooltip(spell)" />
            </span>
            <span>Uses: <strong>{{ usesDisplay(spell, preparedCounts[spell.id] ?? 0) }}</strong></span>
          </div>
          <SpellEffectText
            v-if="spell.effectText"
            :effect-text="spell.effectText"
            :computed-values="spell.computedValues"
            :character="statSource"
          />
        </v-card-text>
      </v-card>
    </div>
  </div>
  <p v-else class="text-medium-emphasis">No Magick Domain Talent held - this character is not a Spellcaster.</p>
</template>
