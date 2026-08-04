<script setup lang="ts">
/**
 * A row of small filled/empty segments, one per point of a pool (HP, Willpower) - shows the
 * exact remaining amount at a glance rather than just a proportional fill, and lines up with
 * how damage/healing removes or restores whole points.
 *
 * When `interactive` is set, each segment becomes clickable (sets the pool to that segment's
 * absolute value - `rangeStart + segmentIndex`, so multiple bars sharing one value range, like
 * the Health Bar's three thirds, can each be given their own offset) and shows the resulting
 * delta from `currentValue` on hover (e.g. "-9", "+3").
 */
const props = defineProps<{
  filled: number
  total: number
  color: string
  interactive?: boolean
  rangeStart?: number
  currentValue?: number
}>()
const emit = defineEmits<{ pick: [value: number] }>()

function segmentValue(i: number): number {
  return (props.rangeStart ?? 0) + i
}
function deltaLabel(i: number): string {
  const delta = segmentValue(i) - (props.currentValue ?? 0)
  return delta > 0 ? `+${delta}` : `${delta}`
}
</script>

<template>
  <div class="segmented-bar">
    <template v-if="interactive">
      <v-tooltip v-for="i in total" :key="i" location="top">
        <template #activator="{ props: activatorProps }">
          <div
            v-bind="activatorProps"
            class="segment segment-interactive"
            :style="{ backgroundColor: i <= filled ? color : 'transparent', borderColor: color }"
            @click="emit('pick', segmentValue(i))"
          />
        </template>
        <span>{{ deltaLabel(i) }}</span>
      </v-tooltip>
    </template>
    <template v-else>
      <div
        v-for="i in total"
        :key="i"
        class="segment"
        :style="{ backgroundColor: i <= filled ? color : 'transparent', borderColor: color }"
      />
    </template>
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
.segment-interactive {
  cursor: pointer;
}
.segment-interactive:hover {
  filter: brightness(1.4);
  transform: scaleY(1.15);
}
</style>
