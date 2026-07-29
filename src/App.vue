<script setup lang="ts">
import { useTheme } from 'vuetify'
import { useNavStore } from '@/stores/nav'
import { setStoredTheme } from '@/theme'

const nav = useNavStore()
const theme = useTheme()

function toggleTheme() {
  const next = theme.global.current.value.dark ? 'light' : 'dark'
  theme.global.name.value = next
  setStoredTheme(next)
}
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
        <v-btn
          :icon="theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          variant="text"
          :aria-label="theme.global.current.value.dark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        />
      </template>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
