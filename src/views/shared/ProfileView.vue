<script setup>
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import { useForm } from '@/composables/useForm'
import { phone as formatPhone } from '@/lib/format'
import { setLocale } from '@/lib/i18n'
import { formatEthiopian } from '@/lib/ethiopianCalendar'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormField from '@/components/ui/FormField.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import PasswordStrength from '@/components/ui/PasswordStrength.vue'

const auth = useAuthStore()
const meta = useMetaStore()
const ui = useUiStore()
const { calendar } = storeToRefs(ui)
onMounted(() => meta.load())

const profile = useForm({
  name: auth.user?.name, email: auth.user?.email, phone: formatPhone(auth.user?.phone) === '—' ? '' : formatPhone(auth.user?.phone),
  city: auth.user?.city ?? '', address: auth.user?.address ?? '', locale: auth.user?.locale ?? 'en',
})
const password = useForm({ current_password: '', password: '', password_confirmation: '' })
const inApp = computed(() => auth.isStaffUser)

async function saveProfile() {
  await profile.submit(() => auth.updateProfile(profile.data)).catch(() => {})
  setLocale(profile.data.locale)
}
async function savePassword() {
  await password.submit(() => api.put('/auth/password', password.data)).then(() => password.reset()).catch(() => {})
}
</script>

<template>
  <div :class="!inApp && 'mx-auto max-w-4xl px-4 py-10 sm:px-6'">
    <PageHeader title="Profile & security" subtitle="Your personal details, language, calendar and password." />

    <div class="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside class="card card-pad h-fit text-center">
        <UserAvatar :name="auth.user?.name" size="lg" class="mx-auto" />
        <p class="mt-3 font-bold text-slate-900">{{ auth.user?.name }}</p>
        <p class="text-sm text-slate-500">{{ auth.roleLabel }}</p>
        <p v-if="auth.tenant" class="mt-1 text-sm font-semibold text-brand-700">{{ auth.tenant.name }}</p>
        <div class="mt-5 rounded-2xl bg-slate-50 p-4 text-left">
          <p class="text-xs font-bold tracking-wide text-slate-500 uppercase">Date display</p>
          <div class="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 text-xs font-semibold ring-1 ring-slate-200">
            <button class="rounded-lg py-1.5" :class="calendar === 'gregorian' ? 'bg-brand-600 text-white' : 'text-slate-500'" @click="calendar = 'gregorian'">Gregorian</button>
            <button class="rounded-lg py-1.5" :class="calendar === 'ethiopian' ? 'bg-brand-600 text-white' : 'text-slate-500'" @click="calendar = 'ethiopian'">Ethiopian</button>
          </div>
          <p class="mt-2 font-am text-xs text-slate-500">ዛሬ: {{ formatEthiopian(new Date(), 'am', { weekday: true }) }}</p>
        </div>
      </aside>

      <div class="space-y-6">
        <form class="card card-pad" @submit.prevent="saveProfile">
          <h2 class="font-bold text-slate-900">Personal details</h2>
          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" :error="profile.errors.value.name"><input v-model="profile.data.name" class="input" required /></FormField>
            <FormField label="Email" :error="profile.errors.value.email"><input v-model="profile.data.email" type="email" class="input" required /></FormField>
            <FormField label="Mobile" :error="profile.errors.value.phone"><input v-model="profile.data.phone" type="tel" class="input" /></FormField>
            <FormField label="City">
              <select v-model="profile.data.city" class="input"><option value="">—</option><option v-for="c in meta.allCities" :key="c" :value="c">{{ c }}</option></select>
            </FormField>
            <FormField label="Address" class="sm:col-span-2"><input v-model="profile.data.address" class="input" placeholder="Sub-city, woreda, house no." /></FormField>
            <FormField label="Language / ቋንቋ">
              <select v-model="profile.data.locale" class="input"><option value="en">English</option><option value="am">አማርኛ (Amharic)</option><option value="om">Afaan Oromoo</option></select>
            </FormField>
          </div>
          <div class="mt-6 flex justify-end"><button class="btn btn-primary" :disabled="profile.processing.value"><AppSpinner v-if="profile.processing.value" /> Save changes</button></div>
        </form>

        <form class="card card-pad" @submit.prevent="savePassword">
          <h2 class="font-bold text-slate-900">Change password</h2>
          <p class="text-sm text-slate-500">Other devices will be signed out.</p>
          <div class="mt-5 grid gap-4 sm:grid-cols-3">
            <FormField label="Current password" :error="password.errors.value.current_password"><input v-model="password.data.current_password" type="password" class="input" autocomplete="current-password" required /></FormField>
            <FormField label="New password" :error="password.errors.value.password">
              <input v-model="password.data.password" type="password" class="input" autocomplete="new-password" required />
              <PasswordStrength :password="password.data.password" />
            </FormField>
            <FormField label="Confirm"><input v-model="password.data.password_confirmation" type="password" class="input" autocomplete="new-password" required /></FormField>
          </div>
          <div class="mt-6 flex justify-end"><button class="btn btn-secondary" :disabled="password.processing.value"><AppSpinner v-if="password.processing.value" /> Update password</button></div>
        </form>
      </div>
    </div>
  </div>
</template>
