<script setup>
import { computed, onMounted, ref } from 'vue'
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

const greeting = computed(() => {
  const h = new Date().getHours()
  if (locale.value === 'am') return h < 12 ? 'እንደምን አደሩ' : h < 18 ? 'እንደምን ዋሉ' : 'እንደምን አመሹ'
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})
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
