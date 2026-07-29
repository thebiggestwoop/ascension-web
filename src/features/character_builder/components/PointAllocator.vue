<script setup lang="ts">
/**
 * Renders `count` independent +1 picks from `items` (repeats allowed, so picking the same
 * item twice reproduces "+2 to one thing" while picking different items reproduces a
 * split). Used anywhere the rules grant "N points, split freely" - Education/Career's
 * Attribute points and Finishing Touches' cap-correction + bonus points.
 *
 * Caller must pre-size `modelValue` to `count` entries (e.g. `Array(count).fill(null)`).
 */
defineProps<{ count: number; items: { title: string; value: string }[]; label: string }>()
const choices = defineModel<(string | null)[]>({ required: true })
</script>

<template>
  <div>
    <v-select
      v-for="i in count"
      :key="i"
      v-model="choices[i - 1]"
      :items="items"
      :label="count > 1 ? `${label} (${i} of ${count})` : label"
      density="compact"
      class="mb-2"
    />
  </div>
</template>
