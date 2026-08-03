<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * Freeform player notes, edited as plain text and previewed as simple Markdown - a small,
 * dependency-free subset (headers, bold/italic, inline code, lists, paragraphs) rather than a
 * full Markdown library, since notes are just player-facing prose, not rules content.
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

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Bold/italic/inline-code only - text is HTML-escaped first, so these regexes only ever wrap
 * already-safe text in tags. */
function renderInline(text: string): string {
  let html = escapeHtml(text)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_m, a, b) => `<strong>${a ?? b}</strong>`)
  html = html.replace(/\*([^*]+)\*|_([^_]+)_/g, (_m, a, b) => `<em>${a ?? b}</em>`)
  return html
}

const HEADER_CLASS = ['text-h6', 'text-subtitle-1', 'text-subtitle-2']

/** Tiny line-based Markdown-lite renderer: #/##/### headers, -/* bullet lists, 1. numbered
 * lists, and blank-line-separated paragraphs (single newlines become <br>). */
function renderMarkdownLite(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let listTag: 'ul' | 'ol' | null = null

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`)
      paragraph = []
    }
  }
  function flushList() {
    if (listTag && listItems.length) {
      blocks.push(`<${listTag}>${listItems.map((li) => `<li>${renderInline(li)}</li>`).join('')}</${listTag}>`)
    }
    listItems = []
    listTag = null
  }

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }
    const header = line.match(/^(#{1,3})\s+(.*)$/)
    if (header) {
      flushParagraph()
      flushList()
      const level = header[1].length - 1
      blocks.push(`<div class="${HEADER_CLASS[level]}">${renderInline(header[2])}</div>`)
      continue
    }
    const bullet = line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      if (listTag !== 'ul') flushList()
      listTag = 'ul'
      listItems.push(bullet[1])
      continue
    }
    const numbered = line.match(/^\d+\.\s+(.*)$/)
    if (numbered) {
      flushParagraph()
      if (listTag !== 'ol') flushList()
      listTag = 'ol'
      listItems.push(numbered[1])
      continue
    }
    flushList()
    paragraph.push(line)
  }
  flushParagraph()
  flushList()
  return blocks.join('') || '<p class="text-medium-emphasis">Nothing written yet.</p>'
}

const previewHtml = computed(() => renderMarkdownLite(props.modelValue))
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
    <div v-else class="notes-preview" v-html="previewHtml" />
  </div>
</template>

<style scoped>
.notes-preview :deep(p) {
  margin: 0 0 8px;
  white-space: pre-wrap;
}
.notes-preview :deep(ul),
.notes-preview :deep(ol) {
  margin: 0 0 8px;
  padding-left: 24px;
}
.notes-preview :deep(*:last-child) {
  margin-bottom: 0;
}
</style>
