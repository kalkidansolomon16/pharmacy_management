<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowPathIcon, ClockIcon, NoSymbolIcon, PencilSquareIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useForm } from '@/composables/useForm'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import FormField from '@/components/ui/FormField.vue'

const auth = useAuthStore()
const router = useRouter()
const checking = ref(false)
const lastChecked = ref(null)
const status = computed(() => auth.tenant?.status ?? auth.blockedReason?.replace('tenant_', '') ?? 'pending')
const reason = computed(() => auth.tenant?.status_reason)

async function recheck({ quiet = false } = {}) {
  if (checking.value) return
  if (!quiet) checking.value = true
  try {
    await auth.fetchMe()
    lastChecked.value = new Date()
  } finally {
    checking.value = false
  }
  if (auth.tenantActive) router.push(auth.homeRoute)
}

// Check by itself every minute, and as soon as the person comes back to this tab
const AUTO_CHECK_MS = 60_000
let timer = null
const onVisible = () => document.visibilityState === 'visible' && recheck({ quiet: true })
onMounted(() => {
  timer = setInterval(() => recheck({ quiet: true }), AUTO_CHECK_MS)
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})

async function signOut() {
  await auth.logout()
  router.push({ name: 'login' })
}

// Fix and resubmit a rejected registration (organization admin only)
const canResubmit = computed(() => status.value === 'rejected' && auth.can('organization.manage'))
const editing = ref(false)
const form = useForm({ name: '', license_number: '', tin_number: '', phone: '', email: '', address_line: '', note: '' })
function startEditing() {
  const t = auth.tenant ?? {}
  Object.assign(form.data, {
    name: t.name ?? '', license_number: t.license_number ?? '', tin_number: t.tin_number ?? '',
    phone: t.phone ?? '', email: t.email ?? '', address_line: t.address_line ?? '', note: '',
  })
  form.errors.value = {}
  editing.value = true
}
async function resubmit() {
  const e = {}
  if (!form.data.name.trim()) e.name = 'Enter the organization name.'
  if (!form.data.license_number.trim()) e.license_number = 'Enter the licence number.'
  if (!form.data.phone.trim()) e.phone = 'Enter a phone number.'
  if (form.data.tin_number && form.data.tin_number.replace(/\D/g, '').length !== 10) e.tin_number = 'The TIN must be exactly 10 digits.'
  form.errors.value = e
  if (Object.keys(e).length) return
  try {
    await form.submit(() => api.post('/organization/resubmit', form.data))
    editing.value = false
    await recheck({ quiet: true })
  } catch {
    // Field errors are shown under each field
  }
}
const err = (key) => form.errors.value[key]
const timeText = (d) => d?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="text-center">
    <span class="mx-auto grid size-20 place-items-center rounded-3xl" :class="status === 'pending' ? 'bg-gold-100 text-amber-600' : 'bg-rose-50 text-rose-600'">
      <component :is="status === 'pending' ? ClockIcon : NoSymbolIcon" class="size-10" />
    </span>
    <h1 class="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
      {{ status === 'pending' ? 'Verification in progress' : status === 'rejected' ? 'Registration not approved yet' : `Account ${status}` }}
    </h1>
    <p class="mx-auto mt-3 max-w-md text-slate-500">
      <template v-if="status === 'pending'">
        Thanks for registering <b class="text-slate-800">{{ auth.tenant?.name }}</b>. Our team is checking your licence
        <b class="text-slate-800">{{ auth.tenant?.license_number }}</b>. We'll email you at <b class="text-slate-800">{{ auth.user?.email }}</b> and notify you here as soon as it's decided - usually within 1-2 working days.
      </template>
      <template v-else-if="status === 'rejected'">
        We could not approve <b class="text-slate-800">{{ auth.tenant?.name }}</b> yet.
        <template v-if="canResubmit">Fix the details below and send them back for review.</template>
        <template v-else>Your organization administrator can correct the details and resubmit.</template>
      </template>
      <template v-else>
        <b class="text-slate-800">{{ auth.tenant?.name }}</b> is currently {{ status }}. Please contact MedLink support to resolve this.
      </template>
    </p>

    <div v-if="reason && status !== 'pending'" class="mx-auto mt-5 max-w-md rounded-2xl bg-rose-50 p-4 text-left ring-1 ring-rose-200">
      <p class="text-xs font-bold uppercase tracking-wide text-rose-500">Reason from the MedLink team</p>
      <p class="mt-1 font-semibold text-rose-900">{{ reason }}</p>
    </div>

    <!-- Fix and resubmit -->
    <form v-if="canResubmit && editing" class="card mx-auto mt-6 grid max-w-lg gap-4 p-5 text-left sm:grid-cols-2" novalidate @submit.prevent="resubmit">
      <FormField label="Organization name" :error="err('name')" class="sm:col-span-2" required><input v-model="form.data.name" class="input" /></FormField>
      <FormField label="Licence number" :error="err('license_number')" required><input v-model="form.data.license_number" class="input" /></FormField>
      <FormField label="TIN (optional)" :error="err('tin_number')"><input v-model="form.data.tin_number" class="input" inputmode="numeric" maxlength="10" /></FormField>
      <FormField label="Phone" :error="err('phone')" required><input v-model="form.data.phone" type="tel" class="input" /></FormField>
      <FormField label="Email (optional)" :error="err('email')"><input v-model="form.data.email" type="email" class="input" /></FormField>
      <FormField label="Street / landmark" :error="err('address_line')" class="sm:col-span-2"><input v-model="form.data.address_line" class="input" /></FormField>
      <FormField label="Note to the MedLink team (optional)" :error="err('note')" class="sm:col-span-2">
        <textarea v-model="form.data.note" rows="2" class="input" placeholder="e.g. Corrected the licence number - copy of the licence sent by email" />
      </FormField>
      <div class="flex justify-end gap-2 sm:col-span-2">
        <button type="button" class="btn btn-secondary" @click="editing = false">Cancel</button>
        <button class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Send for review</button>
      </div>
    </form>

    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <button v-if="canResubmit && !editing" class="btn btn-primary" @click="startEditing"><PencilSquareIcon class="size-4" /> Fix and resubmit</button>
      <button class="btn" :class="canResubmit ? 'btn-secondary' : 'btn-primary'" :disabled="checking" @click="recheck()"><AppSpinner v-if="checking" /><ArrowPathIcon v-else class="size-4" /> Check status</button>
      <button class="btn btn-secondary" @click="signOut">Sign out</button>
    </div>
    <p v-if="status === 'pending'" class="mt-4 text-xs text-slate-400">
      This page checks automatically every minute{{ lastChecked ? ` · last checked ${timeText(lastChecked)}` : '' }}.
    </p>
    <p class="mt-8 text-sm text-slate-400">Support: <a href="tel:+251911000001" class="font-semibold text-brand-700">+251 911 000 001</a> · Mon-Sat, 8:30-17:30 (2:30-11:30 Ethiopian time)</p>
  </div>
</template>
