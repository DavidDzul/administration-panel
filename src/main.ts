import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import axios from './axiosConfig'
import { useAuthStore } from './stores/api/authStore'
import { installUnauthorizedInterceptor } from './utils/unauthorizedInterceptor'

import { createVuetify } from 'vuetify'
import * as componentsVuetify from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { es } from 'vuetify/locale'

import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

const vuetify = createVuetify({
  locale: {
    locale: 'es',
    fallback: 'es',
    messages: { es },
  },
  theme: {
    defaultTheme: 'light',
  },
  directives,
  components: {
    componentsVuetify,
  },
})

const app = createApp(App)
app.use(router)
app.use(vuetify)
app.use(pinia)
app.mount('#app')

// Expired, revoked or disabled session: clear it and send the user to login.
installUnauthorizedInterceptor(axios, (message) => useAuthStore().handleUnauthorized(message))

router.isReady().then(() => {
  const preloader = document.getElementById('preloader')
  if (preloader) {
    preloader.style.display = 'none'
  }
})
