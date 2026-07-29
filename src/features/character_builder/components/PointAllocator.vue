<script setup lang="ts">
/**
 * Renders `count` independent +1 picks from `items` (repeats allowed, so picking the same
 * item twice reproduces "+2 to one thing" while picking different items reproduces a
 * split). Used anywhere the rules grant "N points, split freely" - Education/Career's
 * Attribute points, Finishing Touches' cap-correction + bonus points, and Level Ascension's
 * per-level Attribute/Skill points.
 *
 * Caller must pre-size `modelValue` to `count` entries (e.g. `Array(count).fill(null)`).
 */
const props = defineProps<{
  count: number
  items: { title: string; value: string }[]
  label: string
  /** Optional per-slot disabling (e.g. Level Ascension's Attribute/Skill ceilings). Slot index is 0-based. */
  isItemDisabled?: (itemValue: string, slotIndex: number) => boolean
}>()
const choices = defineModel<(string | null)[]>({ required: true })

function itemsForSlot(slotIndex: number) {
  if (!props.isItemDisabled) return props.items
  return props.items.map((item) => ({ ...item, disabled: props.isItemDisabled!(item.value, slotIndex) }))
}
</script>

<template>
  <div>
    <v-select
      v-for="i in count"
      :key="i"
      v-model="choices[i - 1]"
      :items="itemsForSlot(i - 1)"
      item-props
      :label="count > 1 ? `${label} (${i} of ${count})` : label"
      density="compact"
      class="mb-2"
    />
  </div>
</template>
