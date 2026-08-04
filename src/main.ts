import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'

import App from './App.vue'
import router from './router'
import { getStoredTheme } from './theme'

// vite-plugin-vuetify (see vite.config.ts) auto-imports only the components/directives each
// .vue file's template actually uses, instead of registering (and bundling) the entire library
// here by hand.
const vuetify = createVuetify({
  theme: {
    defaultTheme: getStoredTheme(),
  },
})

createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app')
