<script setup>
import { computed } from 'vue'
import { BanknotesIcon, BuildingOffice2Icon, BuildingStorefrontIcon, ClockIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, number, titleCase } from '@/lib/format'
import { useUiStore } from '@/stores/ui'
import StatCard from '@/components/ui/StatCard.vue'
import DateText from '@/components/ui/DateText.vue'
import AreaChart from '@/components/charts/AreaChart.vue'
import BarList from '@/components/charts/BarList.vue'

const props = defineProps({ data: { type: Object, required: true } })
const emit = defineEmits(['changed'])
const ui = useUiStore()
const s = computed(() => props.data.stats)

async function setStatus(tenant, status) {
  const ok = await ui.confirm({
    title: `${status === 'active' ? 'Approve' : 'Reject'} ${tenant.name}?`,
    message: status === 'active' ? `Licence ${tenant.license_number} has been verified. The organization goes live immediately.` : 'The applicant is notified in the app and by email, with your reason.',
    confirmText: status === 'active' ? 'Approve' : 'Reject',
    danger: status !== 'active',
    input: status === 'rejected' ? { label: 'Reason (sent to the applicant)', placeholder: 'e.g. Licence number not found in the EFDA register', required: true } : undefined,
  })
  if (!ok) return
  try {
    const reason = typeof ok === 'string' ? ok : undefined
    const { data } = await api.patch(`/admin/tenants/${tenant.id}/status`, { status, reason })
    ui.success(data.message)
    emit('changed')
  } catch (e) {
    ui.error(e.message)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Live pharmacies" :value="number(s.pharmacies)" :icon="BuildingStorefrontIcon" :hint="`${s.users} users on the platform`" />
      <StatCard label="Hospitals & clinics" :value="number(s.hospitals)" :icon="BuildingOffice2Icon" tone="sky" :hint="`${s.prescriptions_30d} prescriptions in 30 days`" />
      <StatCard label="Awaiting approval" :value="number(s.pending_approvals)" :icon="ClockIcon" tone="gold" hint="Licence verification" :to="{ name: 'app.admin.tenants', query: { status: 'pending' } }" />
      <StatCard label="GMV (30 days)" :value="money(s.gmv_30d, { compact: true })" :icon="BanknotesIcon" tone="violet" :hint="`${number(s.orders_30d)} fulfilled orders`" />
    </div>

    <div class="grid gap-6 xl:grid-cols-3">
      <section class="card card-pad xl:col-span-2">
        <h2 class="font-bold text-slate-900">Platform sales, last 14 days</h2>
        <AreaChart class="mt-4" :points="data.daily_gmv" color="#7c3aed" :format="(v) => money(v)" />
      </section>
      <section class="card card-pad">
        <h2 class="mb-4 font-bold text-slate-900">Pharmacies by city</h2>
        <BarList :items="data.pharmacies_by_city.map((c) => ({ label: c.city, value: c.total }))" />
      </section>
    </div>

    <section class="card overflow-hidden">
      <div class="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 class="font-bold text-slate-900">Applications awaiting verification</h2>
        <RouterLink :to="{ name: 'app.admin.tenants' }" class="text-xs font-semibold text-brand-700 hover:underline">All organizations</RouterLink>
      </div>
      <ul class="divide-y divide-slate-100">
        <li v-for="t in data.pending_tenants" :key="t.id" class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold-100 text-amber-700">
            <component :is="t.type === 'pharmacy' ? BuildingStorefrontIcon : BuildingOffice2Icon" class="size-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block font-semibold text-slate-900">{{ t.name }} <span class="text-xs font-normal text-slate-500">· {{ titleCase(t.type) }}</span></span>
            <span class="block text-xs text-slate-500">{{ t.city }}<template v-if="t.region">, {{ t.region }}</template> · Licence <b class="font-mono">{{ t.license_number }}</b> · applied <DateText :value="t.created_at" relative /></span>
          </span>
          <span class="flex gap-2">
            <button class="btn btn-soft-danger btn-sm" @click="setStatus(t, 'rejected')">Reject</button>
            <button class="btn btn-primary btn-sm" @click="setStatus(t, 'active')">Approve</button>
          </span>
        </li>
        <li v-if="!data.pending_tenants.length" class="px-5 py-10 text-center text-sm text-slate-500">No pending applications 🎉</li>
      </ul>
    </section>
  </div>
</template>
