<script setup>
import { useList } from '@/composables/useList'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'

const { rows, meta, loading, filters, page } = useList('/stock-movements', { type: '', from: '', to: '', listing_id: '' }, { perPage: 25 })

const columns = [
  { key: 'created_at', label: 'When' },
  { key: 'type', label: 'Type' },
  { key: 'medicine', label: 'Medicine / batch' },
  { key: 'quantity', label: 'Qty', align: 'right' },
  { key: 'reason', label: 'Reason / reference' },
  { key: 'created_by', label: 'By' },
]
</script>

<template>
  <div>
    <PageHeader title="Stock movements" eyebrow="Pharmacy" subtitle="Every unit in and out: receipts, sales, adjustments and expiry write-offs." />
    <div class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <PillTabs v-model="filters.type" :tabs="[{ value: '', label: 'All' }, { value: 'in', label: 'Stock in' }, { value: 'out', label: 'Dispensed' }, { value: 'adjustment', label: 'Adjustments' }, { value: 'expired', label: 'Expired' }]" />
        <div class="flex items-center gap-2">
          <input v-model="filters.from" type="date" class="input w-40" aria-label="From" />
          <span class="text-slate-400">→</span>
          <input v-model="filters.to" type="date" class="input w-40" aria-label="To" />
        </div>
      </div>
      <p v-if="filters.listing_id" class="flex items-center justify-between bg-brand-50 px-4 py-2 text-sm text-brand-800">
        Showing one medicine only. <button class="font-semibold underline" @click="filters.listing_id = ''">Show all</button>
      </p>
      <DataTable :columns="columns" :rows="rows" :loading="loading" empty-title="No stock movements">
        <template #cell-created_at="{ row }"><span class="text-xs text-slate-500"><DateText :value="row.created_at" time /></span></template>
        <template #cell-type="{ row }"><StatusBadge :status="row.type" /></template>
        <template #cell-medicine="{ row }">
          <p class="font-semibold text-slate-800">{{ row.batch?.medicine }}</p>
          <p class="font-mono text-xs text-slate-400">{{ row.batch?.batch_number }}</p>
        </template>
        <template #cell-quantity="{ row }"><b :class="row.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'">{{ row.quantity > 0 ? '+' : '' }}{{ row.quantity }}</b></template>
        <template #cell-reason="{ row }">
          <span class="text-sm text-slate-600">{{ row.reason }}</span>
          <RouterLink v-if="row.reference_type === 'Order'" :to="{ name: 'app.order', params: { id: row.reference_id } }" class="ml-1 text-xs font-semibold text-brand-700 hover:underline">Order #{{ row.reference_id }}</RouterLink>
        </template>
        <template #cell-created_by="{ row }"><span class="text-xs text-slate-500">{{ row.created_by || 'System' }}</span></template>
      </DataTable>
      <AppPagination v-model="page" :meta="meta" />
    </div>
  </div>
</template>
