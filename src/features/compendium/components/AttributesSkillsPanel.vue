<script setup lang="ts">
import { CoreContent } from '@/io/ContentLoader'
</script>

<template>
  <v-row>
    <v-col cols="12" md="6">
      <h3 class="text-h6 mb-2">Attributes</h3>
      <v-card v-for="attr in CoreContent.attributes" :key="attr.id" variant="outlined" class="mb-2">
        <v-card-title>{{ attr.name }}</v-card-title>
        <v-card-text>{{ attr.description }}</v-card-text>
      </v-card>
    </v-col>
    <v-col cols="12" md="6">
      <h3 class="text-h6 mb-2">Skills</h3>
      <v-card v-for="skill in CoreContent.skills" :key="skill.id" variant="outlined" class="mb-2">
        <v-card-title>{{ skill.name }}</v-card-title>
        <v-card-text>{{ skill.description }}</v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
