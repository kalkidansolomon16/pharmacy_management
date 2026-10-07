import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { onSessionProblem } from './lib/api'
import { useAuthStore } from './stores/auth'
import { useUiStore } from './stores/ui'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Central handling of expired sessions and blocked organizations
onSessionProblem((reason) => {
  const auth = useAuthStore(pinia)
  const ui = useUiStore(pinia)
  if (reason === 'expired') {
    auth.clear()
    ui.info('Your session has ended. Please sign in again.')
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
  } else {
    auth.blockedReason = reason
    if (router.currentRoute.value.name !== 'pending') router.push({ name: 'pending' })
  }
})

app.mount('#app')
