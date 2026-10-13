<script setup>
import { computed, onMounted, ref } from 'vue'
import { HeartIcon, MapPinIcon, PencilSquareIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/lib/i18n'
import PharmacyDashboard from '@/components/dashboard/PharmacyDashboard.vue'
import HospitalDashboard from '@/components/dashboard/HospitalDashboard.vue'
import PlatformDashboard from '@/components/dashboard/PlatformDashboard.vue'

const auth = useAuthStore()
const { locale } = useI18n()
const data = ref(null)
const error = ref(null)

async function load() {
  try {
    data.value = (await api.get('/dashboard')).data.data
  } catch (e) {
    error.value = e.message
  }
}
onMounted(load)

// Hospitals & clinics: the specialties patients can find them by
const mySpecialties = ref(null)
onMounted(async () => {
  if (auth.tenantType !== 'hospital') return
  try {
    const { data } = await api.get('/organization/specialties')
    const chosen = new Set(data.data.selected)
    mySpecialties.value = data.data.available.filter((s) => chosen.has(s.id))
  } catch {
    mySpecialties.value = null
  }
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (locale.value === 'am') return h < 12 ? 'እንደምን አደሩ' : h < 18 ? 'እንደምን ዋሉ' : 'እንደምን አመሹ'
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})
const missingPin = computed(() => !!auth.tenant && (auth.tenant.latitude == null || auth.tenant.longitude == null))
const canSetPin = computed(() => auth.can('organization.manage'))
const firstName = computed(() => auth.user?.name?.replace(/^Dr\.?\s*/, 'Dr. ').split(' ').slice(0, auth.user?.name?.startsWith('Dr') ? 2 : 1).join(' '))
</script>

<template>
  <div>
    <div class="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-6 text-white shadow-xl shadow-brand-900/20 sm:p-8">
      <div class="pattern-dots absolute inset-0" />
      <div class="absolute -top-16 -right-10 size-64 rounded-full bg-gold-400/20 blur-3xl" />
      <div class="tibeb absolute right-0 bottom-0 left-0 h-2.5 opacity-70" />
      <div class="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p class="text-sm font-semibold text-gold-300" :class="locale === 'am' && 'font-am'">{{ greeting }},</p>
          <h1 class="mt-1 text-3xl font-extrabold tracking-tight">{{ firstName }} 👋</h1>
          <p class="mt-1 text-brand-100/80">
            <template v-if="auth.tenantType === 'pharmacy'">Here's how {{ auth.tenant?.name }} is doing today.</template>
            <template v-else-if="auth.tenantType === 'hospital'">Prescribing overview for {{ auth.tenant?.name }}.</template>
            <template v-else>Platform overview across all regions of Ethiopia.</template>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <template v-if="auth.tenantType === 'pharmacy'">
            <RouterLink v-if="auth.can('sales.create')" :to="{ name: 'app.pos' }" class="btn btn-gold">New sale</RouterLink>
            <RouterLink v-if="auth.can('orders.view')" :to="{ name: 'app.orders', query: { status: 'open' } }" class="btn border border-white/25 text-white hover:bg-white/10">Online orders</RouterLink>
          </template>
          <template v-else-if="auth.tenantType === 'hospital'">
            <RouterLink v-if="auth.can('prescriptions.create')" :to="{ name: 'app.prescriptions.new' }" class="btn btn-gold">Write prescription</RouterLink>
            <RouterLink :to="{ name: 'app.patients' }" class="btn border border-white/25 text-white hover:bg-white/10">Patients</RouterLink>
          </template>
          <template v-else>
            <RouterLink :to="{ name: 'app.admin.tenants', query: { status: 'pending' } }" class="btn btn-gold">Review applications</RouterLink>
          </template>
        </div>
      </div>
    </div>

    <!-- Organizations without a map pin are invisible to "near me" searches -->
    <div v-if="missingPin" class="mb-6 flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 sm:flex-row sm:items-center">
      <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><MapPinIcon class="size-6" /></span>
      <div class="flex-1">
        <p class="font-bold text-amber-900">Customers can't find you on the map yet</p>
        <p class="text-sm text-amber-800">
          {{ auth.tenant?.name }} has no map location, so it does not appear in <b>“near me”</b> searches, on the map or in directions - on the website and the mobile app.
          <template v-if="!canSetPin"> Ask your organization administrator to set it.</template>
        </p>
      </div>
      <RouterLink v-if="canSetPin" :to="{ name: 'app.organization' }" class="btn btn-primary shrink-0"><MapPinIcon class="size-4" /> Set my location</RouterLink>
    </div>

    <!-- Hospital specialties: what patients filter and book by -->
    <div v-if="mySpecialties && !mySpecialties.length" class="mb-6 flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 sm:flex-row sm:items-center">
      <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><HeartIcon class="size-6" /></span>
      <div class="flex-1">
        <p class="font-bold text-amber-900">No specialties chosen yet</p>
        <p class="text-sm text-amber-800">
          Patients who search for a specialty (e.g. Orthopedics & Spine, Pediatrics) on the website or the mobile app cannot find {{ auth.tenant?.name }} yet.
          <template v-if="!canSetPin"> Ask your organization administrator to choose them.</template>
        </p>
      </div>
      <RouterLink v-if="canSetPin" :to="{ name: 'app.organization', hash: '#specialties' }" class="btn btn-primary shrink-0"><HeartIcon class="size-4" /> Choose specialties</RouterLink>
    </div>
    <div v-else-if="mySpecialties?.length" class="card mb-6 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="flex items-center gap-2 font-bold text-slate-900"><HeartIcon class="size-5 text-brand-600" /> Our specialties <span class="text-sm font-semibold text-slate-400">· patients find you by these</span></p>
        <RouterLink v-if="canSetPin" :to="{ name: 'app.organization', hash: '#specialties' }" class="btn btn-secondary btn-sm"><PencilSquareIcon class="size-4" /> Edit</RouterLink>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <span v-for="s in mySpecialties" :key="s.id" class="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800 ring-1 ring-brand-100">{{ s.name }}</span>
      </div>
    </div>

    <p v-if="error" class="card p-6 text-rose-600">{{ error }}</p>
    <div v-else-if="!data" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="i in 4" :key="i" class="skeleton h-32 rounded-2xl" />
      <div class="skeleton h-80 rounded-2xl sm:col-span-2 lg:col-span-3" />
      <div class="skeleton h-80 rounded-2xl" />
    </div>
    <PharmacyDashboard v-else-if="data.type === 'pharmacy'" :data="data" />
    <HospitalDashboard v-else-if="data.type === 'hospital'" :data="data" />
    <PlatformDashboard v-else-if="data.type === 'platform'" :data="data" @changed="load" />
  </div>
</template>
