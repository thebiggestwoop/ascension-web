<script setup lang="ts">
import { useNavStore } from '@/stores/nav'

const nav = useNavStore()
</script>

<template>
  <v-app>
    <v-app-bar title="Ascension">
      <template #append>
        <v-btn
          v-for="item in nav.links"
          :key="item.to"
          :to="item.to"
          :text="item.label"
          variant="text"
        />
      </template>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
