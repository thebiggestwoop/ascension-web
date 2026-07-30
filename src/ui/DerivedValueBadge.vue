<script setup lang="ts">
/**
 * An inline "oval" badge marking a number as derived from the character (vs. flavor text),
 * with a tooltip explaining the calculation on hover. Generic/presentational only - callers
 * compute `display`/`tooltip`.
 */
defineProps<{ display: string; tooltip: string }>()
</script>

<template>
  <v-tooltip :text="tooltip" location="top" max-width="280">
    <template #activator="{ props }">
      <span v-bind="props" class="derived-value-badge">{{ display }}</span>
    </template>
  </v-tooltip>
</template>

<style scoped>
.derived-value-badge {
  display: inline-block;
  border: 1.5px solid currentColor;
  border-radius: 999px;
  padding: 0 8px;
  margin: 0 2px;
  font-weight: 600;
  cursor: help;
  line-height: 1.6;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
