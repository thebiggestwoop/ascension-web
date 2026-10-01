<script setup lang="ts">
/** A rulebook document as section cards, with jump links grouped by chapter. */
import { computed } from 'vue'
import type { IRulesDocument } from '@/classes/RulesText'
import RulesBlocks from './RulesBlocks.vue'

const props = defineProps<{ document: IRulesDocument }>()

/** Jump links, grouped under their chapter when the document spans several. */
const groups = computed(() => {
  const byChapter = new Map<string, { id: string; title: string }[]>()
  for (const s of props.document.sections) {
    const key = s.chapter ?? ''
    if (!byChapter.has(key)) byChapter.set(key, [])
    byChapter.get(key)!.push({ id: s.id, title: s.intro ? 'Introduction' : s.title })
  }
  return [...byChapter.entries()].map(([chapter, links]) => ({ chapter, links }))
})

const showChapterHeadings = computed(() => (props.document.chapters?.length ?? 0) > 1)

function jumpTo(id: string) {
  document.getElementById(`rules-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="rules-document">
    <div class="mb-4">
      <div v-for="g in groups" :key="g.chapter" class="mb-2">
        <div v-if="g.chapter && showChapterHeadings" class="text-overline text-medium-emphasis">{{ g.chapter }}</div>
        <div class="d-flex flex-wrap ga-2">
          <v-chip v-for="l in g.links" :key="l.id" size="small" variant="outlined" @click="jumpTo(l.id)">
            {{ l.title }}
          </v-chip>
        </div>
      </div>
    </div>

    <template v-for="s in document.sections" :key="s.id">
      <h3 v-if="s.intro" :id="`rules-${s.id}`" class="text-h6 mb-2 rules-anchor">{{ s.title }}</h3>
      <v-card :id="s.intro ? undefined : `rules-${s.id}`" variant="outlined" class="mb-4 rules-anchor">
        <v-card-title v-if="!s.intro" class="text-h6 text-wrap">{{ s.title }}</v-card-title>
        <v-card-text :class="{ 'pt-4': s.intro }">
          <RulesBlocks :blocks="s.blocks" />
        </v-card-text>
      </v-card>
    </template>
  </div>
</template>

<style scoped>
.rules-document {
  max-width: 1000px;
}
.rules-anchor {
  scroll-margin-top: calc(64px + env(safe-area-inset-top, 0px) + 16px);
}
</style>
