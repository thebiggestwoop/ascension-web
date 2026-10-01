<script setup lang="ts">
import { ref, watch } from 'vue'
import MarkdownText from '@/ui/MarkdownText.vue'

/**
 * Freeform player notes, edited as plain text and previewed as simple Markdown (see
 * ui/markdownLite.ts for the supported subset).
 */
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ change: [notes: string] }>()

const mode = ref<'edit' | 'preview'>(props.modelValue.trim() ? 'preview' : 'edit')

/** Local draft so typing doesn't fight external updates - synced from the prop except while
 * the textarea itself is focused, the same "edit locally, commit on blur" shape used for the
 * HP card's Temp HP/Temp Resistance fields. */
const draft = ref(props.modelValue)
const focused = ref(false)
watch(
  () => props.modelValue,
  (v) => {
    if (!focused.value) draft.value = v
  },
)

function commit() {
  focused.value = false
  if (draft.value !== props.modelValue) emit('change', draft.value)
}
</script>

<template>
  <div>
    <v-btn-toggle v-model="mode" mandatory density="compact" color="primary" variant="outlined" class="mb-2">
      <v-btn value="edit" size="small">Edit</v-btn>
      <v-btn value="preview" size="small">Preview</v-btn>
    </v-btn-toggle>

    <v-textarea
      v-if="mode === 'edit'"
      v-model="draft"
      placeholder="Write notes here... supports # headers, **bold**, *italic*, `code`, and - lists."
      density="compact"
      variant="outlined"
      auto-grow
      rows="6"
      @focus="focused = true"
      @blur="commit"
    />
    <MarkdownText v-else-if="modelValue.trim()" :source="modelValue" />
    <p v-else class="text-medium-emphasis">Nothing written yet.</p>
  </div>
</template>
