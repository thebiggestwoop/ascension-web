<script setup lang="ts">
/**
 * A row of small filled/empty segments, one per point of a pool (HP, Willpower) - shows the
 * exact remaining amount at a glance rather than just a proportional fill, and lines up with
 * how damage/healing removes or restores whole points.
 */
defineProps<{ filled: number; total: number; color: string }>()
</script>

<template>
  <div class="segmented-bar">
    <div
      v-for="i in total"
      :key="i"
      class="segment"
      :style="{ backgroundColor: i <= filled ? color : 'transparent', borderColor: color }"
    />
  </div>
</template>

<style scoped>
.segmented-bar {
  display: flex;
  gap: 1px;
  height: 18px;
}
.segment {
  flex: 1;
  min-width: 2px;
  border: 1.5px solid;
  border-radius: 2px;
}
</style>
