<script setup>
import { computed } from 'vue'
import { ClipboardDocumentListIcon, DocumentCheckIcon, UserGroupIcon, UsersIcon } from '@heroicons/vue/24/outline'
import { number, titleCase } from '@/lib/format'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import AreaChart from '@/components/charts/AreaChart.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import BarList from '@/components/charts/BarList.vue'

const props = defineProps({ data: { type: Object, required: true } })
const s = computed(() => props.data.stats)

const statusColors = { active: '#10b981', partially_dispensed: '#f97316', dispensed: '#0ea5e9', expired: '#e11d48', cancelled: '#94a3b8' }
const segments = computed(() => Object.entries(props.data.by_status).map(([k, v]) => ({ label: titleCase(k), value: v, color: statusColors[k] ?? '#94a3b8' })))
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Prescriptions today" :value="number(s.prescriptions_today)" :icon="ClipboardDocumentListIcon" :hint="`${s.prescriptions_30d} in the last 30 days`" />
      <StatCard label="Active prescriptions" :value="number(s.active_prescriptions)" :icon="DocumentCheckIcon" tone="sky" hint="Can still be dispensed" :to="{ name: 'app.prescriptions', query: { status: 'active' } }" />
      <StatCard label="Dispense rate (30d)" :value="`${s.dispense_rate}%`" :icon="UserGroupIcon" tone="gold" hint="Filled at a pharmacy" />
      <StatCard label="Registered patients" :value="number(s.patients)" :icon="UsersIcon" tone="violet" :hint="`${s.doctors} doctors`" :to="{ name: 'app.patients' }" />
    </div>

    <div class="grid gap-6 xl:grid-cols-3">
      <section class="card card-pad xl:col-span-2">
        <h2 class="font-bold text-slate-900">Prescriptions issued, last 14 days</h2>
        <AreaChart class="mt-4" :points="data.daily_prescriptions" color="#0284c7" :format="(v) => `${v} prescriptions`" />
      </section>
      <section class="card card-pad">
        <h2 class="font-bold text-slate-900">Status (30 days)</h2>
        <DonutChart v-if="segments.length" class="mt-5" :segments="segments" center-label="Issued" />
        <p v-else class="mt-4 text-sm text-slate-500">No prescriptions yet.</p>
      </section>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <section class="card card-pad">
        <h2 class="mb-4 font-bold text-slate-900">Most prescribed</h2>
        <BarList :items="data.top_medicines.map((m) => ({ label: m.name, sub: `${m.quantity} units`, value: m.times }))" color="from-sky-400 to-sky-600" :format="(v) => `${v}×`" />
      </section>
      <section class="card overflow-hidden">
        <div class="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 class="font-bold text-slate-900">Recent prescriptions</h2>
          <RouterLink :to="{ name: 'app.prescriptions' }" class="text-xs font-semibold text-brand-700 hover:underline">View all</RouterLink>
        </div>
        <ul class="divide-y divide-slate-100">
          <li v-for="p in data.recent_prescriptions" :key="p.id">
            <RouterLink :to="{ name: 'app.prescription', params: { id: p.id } }" class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-slate-900">{{ p.patient?.full_name }}</span>
                <span class="block text-xs text-slate-500"><span class="font-mono">{{ p.reference_code }}</span> · {{ p.doctor?.name }} · {{ p.items_count }} item(s)</span>
              </span>
              <StatusBadge :status="p.status" />
              <span class="hidden w-24 text-right text-xs text-slate-400 sm:block"><DateText :value="p.issued_at" relative /></span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
