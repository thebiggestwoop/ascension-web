<script setup lang="ts">
/** The Quick Reference sheet, rendered verbatim from content/quick-reference.json. */
import { CoreContent } from '@/io/ContentLoader'
import RulesDocumentPanel from './RulesDocumentPanel.vue'
</script>

<template>
  <RulesDocumentPanel :document="CoreContent.quickReference" />
</template>
