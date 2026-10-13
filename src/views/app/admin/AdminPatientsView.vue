<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ShieldCheckIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { number, phone } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import DateText from '@/components/ui/DateText.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

/**
 * Platform team: every patient registered at any hospital / clinic, and which one.
 * Identity and activity only - no diagnoses or notes. Opening this page is recorded in the audit log.
 */
const route = useRoute()
const router = useRouter()
const rows = ref([])
const meta = ref({})
const loading = ref(false)
const page = ref(Number(route.query.page) || 1)
const search = ref(route.query.search ?? '')
const tenantId = ref(route.query.tenant_id ? Number(route.query.tenant_id) : '')
const gender = ref(route.query.gender ?? '')

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/admin/patients', {
      params: { page: page.value, search: search.value || undefined, tenant_id: tenantId.value || undefined, gender: gender.value || undefined },
    })
    rows.value = data.data
    meta.value = data.meta
  } finally {
    loading.value = false
  }
}
onMounted(load)
let debounce
watch(search, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => (page.value === 1 ? load() : (page.value = 1)), 350)
})
watch([tenantId, gender], () => (page.value === 1 ? load() : (page.value = 1)))
watch(page, load)
watch([page, search, tenantId, gender], () => {
  router.replace({ query: { page: page.value > 1 ? page.value : undefined, search: search.value || undefined, tenant_id: tenantId.value || undefined, gender: gender.value || undefined } }).catch(() => {})
})

const totals = computed(() => meta.value.totals ?? {})
const hospitals = computed(() => meta.value.hospitals ?? [])
const selectedHospital = computed(() => hospitals.value.find((h) => h.id === tenantId.value))
</script>

<template>
  <div>
    <PageHeader title="Patients" eyebrow="Platform" subtitle="Every patient registered at a hospital or clinic on MedLink, and where they are registered. The same person can appear at more than one hospital." />

    <div class="mb-5 grid gap-4 sm:grid-cols-3">
      <div class="card p-4"><p class="text-xs text-slate-500">Patients (all hospitals)</p><p class="text-2xl font-extrabold text-slate-900">{{ number(totals.patients ?? 0) }}</p></div>
      <div class="card p-4"><p class="text-xs text-slate-500">New in the last 30 days</p><p class="text-2xl font-extrabold text-slate-900">{{ number(totals.new_30d ?? 0) }}</p></div>
      <div class="card p-4"><p class="text-xs text-slate-500">With a MedLink patient account</p><p class="text-2xl font-extrabold text-slate-900">{{ number(totals.with_account ?? 0) }}</p></div>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <SearchInput v-model="search" placeholder="Name, phone or card number (MRN)" class="w-72" />
      <select v-model="tenantId" class="input h-11 w-auto max-w-xs">
        <option value="">All hospitals & clinics</option>
        <option v-for="h in hospitals" :key="h.id" :value="h.id">{{ h.name }} ({{ h.patients }})</option>
      </select>
      <select v-model="gender" class="input h-11 w-auto">
        <option value="">Any gender</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
      </select>
      <p class="text-sm text-slate-500">
        {{ number(meta.total ?? 0) }} {{ meta.total === 1 ? 'patient' : 'patients' }}<template v-if="selectedHospital"> at <b>{{ selectedHospital.name }}</b></template>
      </p>
    </div>

    <div v-if="loading && !rows.length" class="skeleton h-80 rounded-2xl" />
    <EmptyState v-else-if="!rows.length" title="No patients found" text="Try another name, phone or hospital." />
    <div v-else class="card overflow-x-auto">
      <table class="w-full min-w-[56rem] text-sm">
        <thead class="bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
          <tr>
            <th class="px-4 py-3">Patient</th>
            <th class="px-4 py-3">Hospital / clinic</th>
            <th class="px-4 py-3">Phone</th>
            <th class="px-4 py-3 text-center">Visits</th>
            <th class="px-4 py-3 text-center">Prescriptions</th>
            <th class="px-4 py-3">Last visit</th>
            <th class="px-4 py-3">Registered</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="p in rows" :key="p.id" class="hover:bg-slate-50/70">
            <td class="px-4 py-3">
              <p class="font-semibold text-slate-900">{{ p.full_name }}</p>
              <p class="text-xs text-slate-500">
                <span v-if="p.mrn" class="font-mono">{{ p.mrn }} · </span>{{ p.gender === 'male' ? 'Male' : 'Female' }}<template v-if="p.age != null"> · {{ p.age }} y</template>
                <span v-if="p.has_account" class="ml-1 rounded-full bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700">app user</span>
              </p>
            </td>
            <td class="px-4 py-3">
              <button v-if="p.hospital" class="text-left hover:text-brand-700" title="Show only this hospital's patients" @click="tenantId = p.hospital.id">
                <p class="font-semibold">{{ p.hospital.name }}</p>
                <p class="text-xs text-slate-500">{{ [p.hospital.sub_city, p.hospital.city].filter(Boolean).join(', ') }}<span v-if="p.hospital.status !== 'active'" class="ml-1 text-amber-700">({{ p.hospital.status }})</span></p>
              </button>
              <span v-else class="text-slate-400">—</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">{{ phone(p.phone) }}</td>
            <td class="px-4 py-3 text-center font-semibold">{{ p.visits_count }}</td>
            <td class="px-4 py-3 text-center font-semibold">{{ p.prescriptions_count }}</td>
            <td class="px-4 py-3 text-slate-600"><DateText v-if="p.last_visit_at" :value="p.last_visit_at" relative /><span v-else class="text-slate-400">—</span></td>
            <td class="px-4 py-3 text-slate-600"><DateText :value="p.registered_at" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination v-model="page" :meta="meta" />

    <p class="mt-4 flex items-start gap-2 text-xs text-slate-500">
      <ShieldCheckIcon class="size-4 shrink-0 text-brand-600" />
      Patient privacy: this list shows identity and activity only - diagnoses, notes and results stay with each hospital. Opening it is recorded in the audit log.
    </p>
  </div>
</template>
