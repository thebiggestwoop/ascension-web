<script setup lang="ts">
/**
 * A chip that shows explanatory text in a tooltip on hover - used for game terms whose full
 * meaning isn't obvious from the label alone (Equipment Qualities, Weapon Tags, Damage
 * Effects). Generic/presentational only; callers supply the label and tooltip text.
 */
defineProps<{ label: string; tooltip?: string }>()
</script>

<template>
  <v-tooltip v-if="tooltip" :text="tooltip" location="top" max-width="320">
    <template #activator="{ props: activatorProps }">
      <v-chip v-bind="activatorProps" size="small" class="mr-1 mb-1">{{ label }}</v-chip>
    </template>
  </v-tooltip>
  <v-chip v-else size="small" class="mr-1 mb-1">{{ label }}</v-chip>
</template>
