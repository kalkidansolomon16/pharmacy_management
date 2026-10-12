<script setup>
import { computed, ref, watch } from 'vue'
import { ArchiveBoxIcon, BanknotesIcon, BuildingStorefrontIcon, ExclamationTriangleIcon, UsersIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, number, titleCase } from '@/lib/format'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import StatCard from '@/components/ui/StatCard.vue'
import AreaChart from '@/components/charts/AreaChart.vue'
import BarList from '@/components/charts/BarList.vue'

const days = ref(30)
const data = ref(null)
const loading = ref(false)
async function load() {
  loading.value = true
  try {
    data.value = (await api.get('/owner/dashboard', { params: { days: days.value } })).data.data
  } finally {
    loading.value = false
  }
}
watch(days, load, { immediate: true })

const departments = computed(() => (data.value?.departments ?? []).map((d) => ({ label: titleCase(d.department), value: d.revenue })))
const shortMoney = (v) => money(v, { compact: true })
</script>

<template>
  <div>
    <PageHeader title="Owner overview" eyebrow="All branches" subtitle="Revenue, stock value, expiry losses and money owed - across every branch and department, on your phone.">
      <PillTabs v-model="days" :tabs="[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }]" />
    </PageHeader>

    <div v-if="!data" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div v-for="i in 4" :key="i" class="skeleton h-32 rounded-2xl" /></div>
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" :class="loading && 'opacity-60'">
        <StatCard label="Revenue today" :value="money(data.totals.revenue_today)" :icon="BanknotesIcon" :hint="`${money(data.totals.revenue_period, { compact: true })} in ${days} days`" />
        <StatCard label="Stock value (cost)" :value="money(data.totals.stock_value, { compact: true })" :icon="ArchiveBoxIcon" tone="sky" />
        <StatCard label="Owed to you" :value="money(data.totals.receivables, { compact: true })" :icon="UsersIcon" tone="gold" hint="patients + insurers" />
        <StatCard label="Expiry losses" :value="money(data.totals.expiry_loss)" :icon="ExclamationTriangleIcon" :tone="data.totals.expiry_loss ? 'rose' : 'violet'" :hint="`last ${days} days`" />
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <section class="card card-pad">
          <h2 class="font-bold text-slate-900">Daily revenue · all branches</h2>
          <AreaChart :points="data.daily_revenue" :format="shortMoney" class="mt-4" />
        </section>
        <section class="card card-pad">
          <h2 class="font-bold text-slate-900">By department</h2>
          <BarList :items="departments" :format="shortMoney" class="mt-4" />
          <p v-if="!departments.length" class="mt-4 text-sm text-slate-500">No invoices in this period.</p>
        </section>
      </div>

      <section class="card mt-6 overflow-hidden">
        <h2 class="border-b border-slate-100 px-5 py-4 font-bold text-slate-900">Branches</h2>
        <div class="overflow-x-auto scrollbar-thin">
          <table class="table text-sm">
            <thead><tr><th>Branch</th><th class="text-right">Today</th><th class="text-right">{{ days }} days</th><th class="text-right">Stock value</th><th class="text-right">Owed</th><th class="text-right">Expiry loss</th><th class="text-right">Visits</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="b in data.branches" :key="b.id">
                <td><p class="flex items-center gap-2 font-semibold"><BuildingStorefrontIcon class="size-4 text-brand-600" /> {{ b.name }}</p><p class="text-xs text-slate-500">{{ b.city }} · {{ b.is_branch ? 'Branch' : 'Head office' }} <span v-if="b.status !== 'active'" class="font-bold text-amber-600">· {{ b.status }}</span></p></td>
                <td class="text-right">{{ money(b.revenue_today, { symbol: '' }) }}</td>
                <td class="text-right font-bold">{{ money(b.revenue_period, { symbol: '' }) }}</td>
                <td class="text-right">{{ money(b.stock_value, { symbol: '', compact: true }) }}</td>
                <td class="text-right">{{ money(b.receivables, { symbol: '' }) }}</td>
                <td class="text-right" :class="b.expiry_loss && 'text-rose-600'">{{ money(b.expiry_loss, { symbol: '' }) }}</td>
                <td class="text-right">{{ number(b.visits_period) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="data.doctors.length" class="card mt-6 overflow-hidden">
        <h2 class="border-b border-slate-100 px-5 py-4 font-bold text-slate-900">Doctors</h2>
        <table class="table text-sm">
          <thead><tr><th>Doctor</th><th class="text-right">Visits</th><th class="text-right">Completed</th><th class="text-right">Prescriptions</th><th class="text-right">Revenue</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="d in data.doctors" :key="d.id"><td class="font-semibold">{{ d.name }}</td><td class="text-right">{{ d.visits }}</td><td class="text-right">{{ d.completed }}</td><td class="text-right">{{ d.prescriptions }}</td><td class="text-right font-bold">{{ money(d.revenue) }}</td></tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>
