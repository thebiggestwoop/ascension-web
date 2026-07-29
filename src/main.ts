import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

import App from './App.vue'
import router from './router'
import { getStoredTheme } from './theme'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: getStoredTheme(),
  },
})

createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app')
