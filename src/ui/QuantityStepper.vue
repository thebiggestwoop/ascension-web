<script setup lang="ts">
/** A generic "- N +" stepper. No game knowledge - callers own what N means and its bounds. */
const props = withDefaults(defineProps<{ modelValue: number; min?: number; max?: number }>(), {
  min: 0,
})
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function dec() {
  if (props.modelValue > props.min) emit('update:modelValue', props.modelValue - 1)
}
function inc() {
  if (props.max === undefined || props.modelValue < props.max) emit('update:modelValue', props.modelValue + 1)
}
</script>

<template>
  <div class="d-flex align-center">
    <v-btn size="x-small" icon="mdi-minus" variant="tonal" :disabled="modelValue <= min" @click="dec" />
    <span class="mx-2" style="min-width: 1.5em; text-align: center">{{ modelValue }}</span>
    <v-btn size="x-small" icon="mdi-plus" variant="tonal" :disabled="max !== undefined && modelValue >= max" @click="inc" />
  </div>
</template>
