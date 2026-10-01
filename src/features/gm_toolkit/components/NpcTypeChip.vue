<script setup lang="ts">
/**
 * A chip in an NPC Type's rulebook highlight colour (see content/npcs/types.json), with
 * black or white text picked by the colour's luminance so e.g. Dark (#000000) stays legible.
 */
import { computed } from 'vue'
import { CoreContent } from '@/io/ContentLoader'

const props = defineProps<{ typeName: string; size?: string }>()

const type = computed(() => CoreContent.npcs.types.find((t) => t.name === props.typeName))

const textColor = computed(() => {
  const hex = type.value?.color.replace('#', '')
  if (!hex) return undefined
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55 ? '#000000' : '#ffffff'
})
</script>

<template>
  <v-tooltip v-if="type" :text="type.description" location="top" max-width="360">
    <template #activator="{ props: activatorProps }">
      <v-chip
        v-bind="activatorProps"
        :size="size ?? 'small'"
        variant="flat"
        :style="{ backgroundColor: type.color, color: textColor }"
      >
        {{ typeName }}
      </v-chip>
    </template>
  </v-tooltip>
  <v-chip v-else :size="size ?? 'small'">{{ typeName }}</v-chip>
</template>
