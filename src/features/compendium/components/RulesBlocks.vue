<script setup lang="ts">
/** Renders verbatim rulebook blocks (see RulesText.ts). All text goes through renderInline,
 * which HTML-escapes before adding <strong>/<em>, so v-html is safe here. */
import type { RulesBlock } from '@/classes/RulesText'
import { renderInline } from '@/ui/markdownLite'

defineProps<{ blocks: RulesBlock[] }>()

function html(text: string): string {
  return renderInline(text).replace(/\n/g, '<br>')
}

const DEFAULT_BULLETS = ['●', '○', '■']
</script>

<template>
  <div class="rules-blocks text-body-2">
    <template v-for="(b, i) in blocks" :key="i">
      <div
        v-if="b.type === 'heading'"
        :class="['rules-heading', b.level <= 3 ? 'text-subtitle-1 font-weight-bold' : 'text-subtitle-2 font-weight-bold']"
      >
        {{ b.text }}
      </div>
      <div v-else-if="b.type === 'subheading'" class="rules-heading text-subtitle-1 font-weight-bold">{{ b.text }}</div>
      <!-- eslint-disable-next-line vue/no-v-html -- escaped by renderInline -->
      <p v-else-if="b.type === 'paragraph'" :class="['mb-2', { 'rules-indent': b.indent }]" v-html="html(b.text)" />
      <div v-else-if="b.type === 'list'" class="rules-list mb-2">
        <div
          v-for="(item, j) in b.items"
          :key="j"
          class="rules-list-item"
          :style="{ paddingLeft: `${(item.level + 1) * 24}px` }"
        >
          <span class="rules-marker">{{ item.marker ?? DEFAULT_BULLETS[item.level % 3] }}</span>
          <!-- eslint-disable-next-line vue/no-v-html -- escaped by renderInline -->
          <span v-html="html(item.text)" />
        </div>
      </div>
      <div v-else-if="b.type === 'table'" class="rules-table mb-3">
        <v-table density="compact">
          <thead>
            <tr>
              <!-- eslint-disable-next-line vue/no-v-html -- escaped by renderInline -->
              <th v-for="(cell, c) in b.rows[0]" :key="c" v-html="html(cell)" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in b.rows.slice(1)" :key="r">
              <!-- eslint-disable-next-line vue/no-v-html -- escaped by renderInline -->
              <td
                v-for="(cell, c) in row"
                :key="c"
                :colspan="c === row.length - 1 ? Math.max(1, b.rows[0].length - row.length + 1) : undefined"
                v-html="html(cell)"
              />
            </tr>
          </tbody>
        </v-table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rules-heading {
  margin: 16px 0 6px;
}
.rules-heading:first-child {
  margin-top: 0;
}
.rules-indent {
  margin-left: 24px;
  padding-left: 12px;
  border-left: 3px solid rgba(var(--v-theme-on-surface), 0.2);
}
.rules-list-item {
  position: relative;
  margin-bottom: 4px;
}
.rules-marker {
  position: absolute;
  transform: translateX(calc(-100% - 6px));
  white-space: nowrap;
}
.rules-table {
  overflow-x: auto;
}
.rules-table td,
.rules-table th {
  vertical-align: top;
  padding-top: 6px !important;
  padding-bottom: 6px !important;
}
</style>
