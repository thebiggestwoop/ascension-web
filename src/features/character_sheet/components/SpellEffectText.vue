<script setup lang="ts">
import { computed } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import type { Character } from '@/classes/Character'
import type { ISpellComputedValue } from '@/classes/Spell'
import DerivedValueBadge from '@/ui/DerivedValueBadge.vue'

function skillName(id: string): string {
  return CoreContent.skills.find((s) => s.id === id)?.name ?? id
}

/**
 * Renders a spell's effectText, splicing in live-computed values (e.g. Penumbra's base
 * damage + Skirmish + per-Wound scaling) as oval badges with a tooltip explaining the math,
 * wherever `computedValues` names a matching literal substring. Only the *first* occurrence
 * of each matchText is substituted - a spell's own later prose describing its scaling rule
 * (e.g. "increases by 2[CD] for each Wound") reuses the same printed number and is
 * deliberately left as plain rule text, not re-substituted.
 */
const props = defineProps<{ effectText: string; computedValues?: ISpellComputedValue[]; character: Character }>()

interface Segment {
  type: 'text' | 'computed'
  text?: string
  display?: string
  tooltip?: string
}

const segments = computed<Segment[]>(() => {
  const cvs = props.computedValues ?? []
  const matches = cvs
    .map((cv) => ({ cv, index: props.effectText.indexOf(cv.matchText) }))
    .filter((m) => m.index !== -1)
    .sort((a, b) => a.index - b.index)

  const wounds = props.character.wounds

  const result: Segment[] = []
  let cursor = 0
  for (const { cv, index } of matches) {
    if (index > cursor) result.push({ type: 'text', text: props.effectText.slice(cursor, index) })

    const bonus = cv.bonusSkill ? props.character.skill(cv.bonusSkill) : 0
    const total = cv.base + bonus + (cv.perWound ?? 0) * wounds
    const parts = [`Base ${cv.base}`]
    if (cv.bonusSkill) parts.push(`${skillName(cv.bonusSkill)} +${bonus}`)
    if (cv.perWound) parts.push(`${wounds} Wound${wounds === 1 ? '' : 's'} x ${cv.perWound} = +${cv.perWound * wounds}`)
    result.push({ type: 'computed', display: `${total}${cv.suffix}`, tooltip: parts.join(', ') })

    cursor = index + cv.matchText.length
  }
  if (cursor < props.effectText.length) result.push({ type: 'text', text: props.effectText.slice(cursor) })
  return result
})
</script>

<template>
  <span>
    <template v-for="(seg, i) in segments" :key="i">
      <template v-if="seg.type === 'text'">{{ seg.text }}</template>
      <DerivedValueBadge v-else :display="seg.display!" :tooltip="seg.tooltip!" />
    </template>
  </span>
</template>
