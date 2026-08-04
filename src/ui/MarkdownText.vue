<script setup lang="ts">
/**
 * Renders `source` through the shared Markdown-lite subset (see markdownLite.ts) - used
 * anywhere player/rules prose needs basic formatting (headers, bold/italic, lists) without
 * pulling in a full Markdown library: Notes' preview, Talent effectText, etc.
 */
import { computed } from 'vue'
import { renderMarkdownLite } from './markdownLite'

const props = defineProps<{ source: string }>()
const html = computed(() => renderMarkdownLite(props.source))
</script>

<template>
  <div class="markdown-text" v-html="html" />
</template>

<style scoped>
.markdown-text :deep(p) {
  margin: 0 0 8px;
  white-space: pre-wrap;
}
.markdown-text :deep(ul),
.markdown-text :deep(ol) {
  margin: 0 0 8px;
  padding-left: 24px;
}
.markdown-text :deep(*:last-child) {
  margin-bottom: 0;
}
</style>
