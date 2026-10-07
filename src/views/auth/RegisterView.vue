<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useForm } from '@/composables/useForm'
import { useI18n } from '@/lib/i18n'
import FormField from '@/components/ui/FormField.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import PasswordStrength from '@/components/ui/PasswordStrength.vue'

const auth = useAuthStore()
const meta = useMetaStore()
const router = useRouter()
const { t, locale } = useI18n()
onMounted(() => meta.load())

const form = useForm({ name: '', email: '', phone: '', city: 'Addis Ababa', password: '', password_confirmation: '' })

async function submit() {
  await form.submit(() => auth.register({ ...form.data, locale: locale.value })).catch(() => {})
  if (auth.isAuthenticated) router.push(router.currentRoute.value.query.redirect || { name: 'search' })
}
</script>

<template>
  <div>
    <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">{{ t('auth.createAccount') }}</h1>
    <p class="mt-2 text-slate-500">Order medicines, use your prescriptions online and track every order.</p>

    <form class="mt-8 grid gap-4 sm:grid-cols-2" @submit.prevent="submit">
      <FormField label="Full name" label-am="ሙሉ ስም" :error="form.errors.value.name" class="sm:col-span-2" required>
        <input v-model="form.data.name" class="input" placeholder="e.g. Abebe Kebede" autocomplete="name" required />
      </FormField>
      <FormField :label="t('auth.email')" :error="form.errors.value.email" required>
        <input v-model="form.data.email" type="email" class="input" autocomplete="email" required />
      </FormField>
      <FormField label="Mobile number" label-am="ስልክ" :error="form.errors.value.phone" hint="Ethio telecom or Safaricom" required>
        <input v-model="form.data.phone" type="tel" class="input" placeholder="0911 223 344" autocomplete="tel" required />
      </FormField>
      <FormField label="City" :error="form.errors.value.city" class="sm:col-span-2">
        <select v-model="form.data.city" class="input">
          <option v-for="c in meta.allCities" :key="c" :value="c">{{ c }}</option>
        </select>
      </FormField>
      <FormField :label="t('auth.password')" :error="form.errors.value.password" required>
        <input v-model="form.data.password" type="password" class="input" autocomplete="new-password" required />
        <PasswordStrength :password="form.data.password" />
      </FormField>
      <FormField label="Confirm password" required>
        <input v-model="form.data.password_confirmation" type="password" class="input" autocomplete="new-password" required />
      </FormField>
      <button class="btn btn-primary btn-lg w-full sm:col-span-2" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> {{ t('auth.createAccount') }}</button>
    </form>

    <p class="mt-6 text-center text-sm text-slate-500">
      {{ t('auth.haveAccount') }} <RouterLink :to="{ name: 'login' }" class="font-semibold text-brand-700 hover:underline">{{ t('nav.signIn') }}</RouterLink>
    </p>
    <p class="mt-2 text-center text-sm text-slate-500">
      Run a pharmacy or hospital? <RouterLink :to="{ name: 'register.organization' }" class="font-semibold text-brand-700 hover:underline">Register your organization</RouterLink>
    </p>
  </div>
</template>
