<script setup lang="ts">
/** One titled section of an NPC stat block (Attacks, Optional Features, ...). */
import type { INpcEntry, NpcTier } from '@/classes/Npc'
import { resolveTierText } from '@/classes/Npc'

defineProps<{ title: string; entries?: INpcEntry[]; note?: string; tier: NpcTier | null }>()

function heading(e: INpcEntry): string {
  return e.tags?.length ? `${e.name} (${e.tags.join(', ')})` : e.name
}
</script>

<template>
  <div v-if="entries?.length" class="mb-4">
    <div class="text-overline text-medium-emphasis">{{ title }}</div>
    <p v-if="note" class="text-body-2 font-italic mb-1">{{ note }}</p>
    <div v-for="(e, i) in entries" :key="`${e.name}-${i}`" class="text-body-2 mb-2">
      <v-chip v-if="e.recharge" size="x-small" color="warning" variant="tonal" class="mr-1">Recharge [!]</v-chip>
      <strong>{{ heading(e) }}:</strong> {{ resolveTierText(e.text, tier) }}
      <div v-if="e.attack" class="ml-4 mt-1">
        <strong>{{ heading(e.attack) }}:</strong> {{ resolveTierText(e.attack.text, tier) }}
      </div>
    </div>
  </div>
</template>
