<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useForm } from '@/composables/useForm'
import { useI18n } from '@/lib/i18n'
import FormField from '@/components/ui/FormField.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const showPassword = ref(false)
const form = useForm({ email: '', password: '' })

async function submit() {
  await form.submit(() => auth.login(form.data), { toastErrors: false }).catch(() => {})
  if (!auth.isAuthenticated) return
  const redirect = route.query.redirect
  router.push(redirect && redirect.startsWith('/') ? redirect : auth.homeRoute)
}

// Seeded demo accounts (development builds only) - see the backend README
const isDev = import.meta.env.DEV
const demo = [
  { role: 'Pharmacy admin', email: 'bole.admin@medlink.et', tone: 'bg-brand-50 text-brand-800' },
  { role: 'Pharmacist', email: 'bole.pharmacist@medlink.et', tone: 'bg-emerald-50 text-emerald-800' },
  { role: 'Doctor', email: 'dr.hana@medlink.et', tone: 'bg-sky-50 text-sky-800' },
  { role: 'Hospital admin', email: 'entoto.admin@medlink.et', tone: 'bg-indigo-50 text-indigo-800' },
  { role: 'Customer', email: 'abebe@example.com', tone: 'bg-gold-50 text-amber-800' },
  { role: 'Platform admin', email: 'admin@medlink.et', tone: 'bg-slate-100 text-slate-700' },
]
const DEMO_PASSWORD = 'Password@123'
function useDemo(account) {
  form.data.email = account.email
  form.data.password = DEMO_PASSWORD
}
</script>

<template>
  <div>
    <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">{{ t('auth.welcomeBack') }} 👋</h1>
    <p class="mt-2 text-slate-500">{{ t('auth.signInSubtitle') }}</p>

    <form class="mt-8 space-y-5" @submit.prevent="submit">
      <div v-if="form.errors.value.email && !form.errors.value.password" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
        {{ form.errors.value.email }}
      </div>
      <FormField :label="t('auth.email')">
        <input v-model="form.data.email" type="email" autocomplete="email" class="input h-12" placeholder="you@example.com" required autofocus />
      </FormField>
      <FormField :label="t('auth.password')" :error="form.errors.value.password">
        <div class="relative">
          <input v-model="form.data.password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" class="input h-12 pr-11" placeholder="••••••••" required />
          <button type="button" class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword">
            <component :is="showPassword ? EyeSlashIcon : EyeIcon" class="size-5" />
          </button>
        </div>
      </FormField>
      <button class="btn btn-primary btn-lg w-full" :disabled="form.processing.value">
        <AppSpinner v-if="form.processing.value" /> {{ t('nav.signIn') }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-slate-500">
      {{ t('auth.noAccount') }}
      <RouterLink :to="{ name: 'register' }" class="font-semibold text-brand-700 hover:underline">{{ t('auth.createAccount') }}</RouterLink>
      · <RouterLink :to="{ name: 'register.organization' }" class="font-semibold text-brand-700 hover:underline">Register a pharmacy / hospital</RouterLink>
    </p>

    <div v-if="isDev" class="mt-10 rounded-2xl border border-dashed border-slate-300 p-4">
      <p class="text-xs font-bold tracking-wide text-slate-500 uppercase">Demo accounts <span class="font-normal normal-case">(development only - click to fill)</span></p>
      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button v-for="a in demo" :key="a.email" type="button" class="rounded-xl px-3 py-2 text-left text-xs transition hover:ring-2 hover:ring-brand-300" :class="a.tone" @click="useDemo(a)">
          <b class="block">{{ a.role }}</b><span class="block truncate opacity-70">{{ a.email }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
