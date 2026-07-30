<script setup lang="ts">
/**
 * A prominent boxed stat display for the Character Sheet's derived stats (Speed, Max HP,
 * Willpower, Resistance, Damage Bonus, Spell Slots). Reuses DerivedValueBadge for the value
 * itself so hovering reveals the calculation exactly like weapon damage does; callers that
 * need adjustment controls (HP/Willpower's +/-) supply them via the `actions` slot.
 */
import DerivedValueBadge from './DerivedValueBadge.vue'

defineProps<{ label: string; display: string; tooltip: string }>()
</script>

<template>
  <v-card variant="tonal" class="stat-tile">
    <div class="text-caption text-medium-emphasis mb-1">{{ label }}</div>
    <DerivedValueBadge :display="display" :tooltip="tooltip" />
    <div v-if="$slots.actions" class="mt-1">
      <slot name="actions" />
    </div>
  </v-card>
</template>

<style scoped>
.stat-tile {
  padding: 12px 8px;
  text-align: center;
  height: 100%;
}
</style>
