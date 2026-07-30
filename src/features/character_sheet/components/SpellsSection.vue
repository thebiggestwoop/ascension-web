<script setup lang="ts">
import { computed } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { SkillId } from '@/classes/enums'
import { resolveMagickDomainAccess, MAGICK_ATTRIBUTE_BY_DOMAIN } from '@/classes/Spell'
import type { ISpellData } from '@/classes/Spell'
import type { Character } from '@/classes/Character'
import DerivedValueBadge from '@/ui/DerivedValueBadge.vue'
import SpellEffectText from './SpellEffectText.vue'

const props = defineProps<{ character: Character; preparedSpellIds: string[] }>()

const allSpells = [...CoreContent.spells.arcane, ...CoreContent.spells.light, ...CoreContent.spells.dark]

const domainAccess = computed(() => resolveMagickDomainAccess(props.character.talentIds))

const preparedGroups = computed(() => {
  const counts: Record<string, number> = {}
  for (const id of props.preparedSpellIds) counts[id] = (counts[id] ?? 0) + 1
  return Object.entries(counts)
    .map(([id, count]) => ({ spell: allSpells.find((s) => s.id === id), count }))
    .filter((g): g is { spell: ISpellData; count: number } => !!g.spell)
})

function attributeName(spell: ISpellData): string {
  const attrId = MAGICK_ATTRIBUTE_BY_DOMAIN[spell.domain]
  return CoreContent.attributes.find((a) => a.id === attrId)?.name ?? attrId
}

function taskValue(spell: ISpellData): number {
  const attrId = MAGICK_ATTRIBUTE_BY_DOMAIN[spell.domain]
  return props.character.attribute(attrId) + props.character.skill(SkillId.Skirmish)
}

function taskTooltip(spell: ISpellData): string {
  const attrId = MAGICK_ATTRIBUTE_BY_DOMAIN[spell.domain]
  const skirmish = props.character.skill(SkillId.Skirmish)
  return `${attributeName(spell)} ${props.character.attribute(attrId)}, Skirmish +${skirmish}`
}

function usesDisplay(spell: ISpellData, count: number): string {
  if (spell.usesPerScene === 'passive') return 'Passive'
  return `${spell.usesPerScene * count} / scene`
}
</script>

<template>
  <div v-if="!domainAccess.length" class="text-medium-emphasis">
    No Magick Domain Talent held - this character is not a Spellcaster.
  </div>
  <div v-else-if="!preparedGroups.length" class="text-medium-emphasis">No spells prepared.</div>
  <v-card v-for="g in preparedGroups" :key="g.spell.id" variant="tonal" class="mb-2">
    <v-card-title class="d-flex align-center justify-space-between">
      <span>{{ g.spell.name }}<span v-if="g.count > 1"> x{{ g.count }}</span></span>
      <v-chip size="small">Tier {{ g.spell.tier }}</v-chip>
    </v-card-title>
    <v-card-subtitle>
      {{ g.spell.tags.join(', ') }} - {{ g.spell.slotCost }} Slot{{ g.spell.slotCost > 1 ? 's' : '' }}
      <span v-if="g.spell.range"> - Range {{ g.spell.range }}</span>
      <span v-if="g.spell.willpowerCost"> - {{ g.spell.willpowerCost }} Willpower</span>
    </v-card-subtitle>
    <v-card-text>
      <div class="mb-2">
        Task: {{ attributeName(g.spell) }}
        <DerivedValueBadge :display="String(taskValue(g.spell))" :tooltip="taskTooltip(g.spell)" />
        - Uses: <strong>{{ usesDisplay(g.spell, g.count) }}</strong>
      </div>
      <SpellEffectText
        v-if="g.spell.effectText"
        :effect-text="g.spell.effectText"
        :computed-values="g.spell.computedValues"
        :character="character"
      />
    </v-card-text>
  </v-card>
</template>
