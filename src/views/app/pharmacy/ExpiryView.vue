<script setup>
import { computed, onMounted, ref } from 'vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, number } from '@/lib/format'
import { useList } from '@/composables/useList'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'

const { rows, meta, loading, filters, page } = useList('/batches', { status: 'expiring', days: '90', search: '' }, { perPage: 20 })
const alerts = ref(null)
onMounted(async () => (alerts.value = (await api.get('/inventory/alerts')).data.data))

const columns = [
  { key: 'medicine', label: 'Medicine' },
  { key: 'batch', label: 'Batch' },
  { key: 'expiry', label: 'Expires' },
  { key: 'quantity', label: 'Units', align: 'right' },
  { key: 'value', label: 'Value at cost', align: 'right' },
  { key: 'supplier', label: 'Supplier' },
]
const atRisk = computed(() => rows.value.reduce((s, b) => s + b.quantity * b.purchase_price, 0))
</script>

<template>
  <div>
    <PageHeader title="Expiry tracker" eyebrow="Pharmacy" subtitle="Batches nearing expiry. Sell them first, offer them to partner pharmacies, or return them to the supplier before they become waste." />

    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <div class="card card-pad border-l-4 border-l-rose-500">
        <p class="text-sm text-slate-500">Expired, still on shelf</p>
        <p class="mt-1 text-2xl font-extrabold text-rose-600">{{ alerts?.expired_with_stock_count ?? '—' }}</p>
        <p class="text-xs text-slate-400">Blocked from sale automatically</p>
      </div>
      <div class="card card-pad border-l-4 border-l-amber-500">
        <p class="text-sm text-slate-500">Expiring within 90 days</p>
        <p class="mt-1 text-2xl font-extrabold text-amber-600">{{ alerts?.expiring_count ?? '—' }}</p>
        <p class="text-xs text-slate-400">Batches with stock</p>
      </div>
      <div class="card card-pad border-l-4 border-l-brand-500">
        <p class="text-sm text-slate-500">Value on this page</p>
        <p class="mt-1 text-2xl font-extrabold text-slate-900">{{ money(atRisk) }}</p>
        <p class="text-xs text-slate-400">At purchase cost</p>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <PillTabs
          :model-value="filters.status === 'expired' ? 'expired' : filters.days"
          :tabs="[{ value: '30', label: '≤ 30 days' }, { value: '90', label: '≤ 90 days' }, { value: '180', label: '≤ 6 months' }, { value: 'expired', label: 'Expired' }]"
          @update:model-value="(v) => (v === 'expired' ? Object.assign(filters, { status: 'expired' }) : Object.assign(filters, { status: 'expiring', days: v }))"
        />
        <SearchInput v-model="filters.search" class="lg:w-72" placeholder="Medicine or batch number" />
      </div>
      <DataTable :columns="columns" :rows="rows" :loading="loading" empty-title="Nothing expiring in this window" empty-text="Great stock rotation! 🎉">
        <template #cell-medicine="{ row }">
          <RouterLink :to="{ name: 'app.inventory.item', params: { id: row.pharmacy_medicine_id } }" class="flex items-center gap-3 hover:text-brand-700">
            <MedicineAvatar :form="row.listing?.medicine?.dosage_form" size="sm" />
            <span class="font-semibold">{{ row.listing?.medicine?.display_name }}</span>
          </RouterLink>
        </template>
        <template #cell-batch="{ row }"><span class="font-mono text-xs font-bold">{{ row.batch_number }}</span></template>
        <template #cell-expiry="{ row }">
          <div class="flex items-center gap-2">
            <ExclamationTriangleIcon v-if="row.days_to_expiry <= 30" class="size-4 text-rose-500" />
            <span><DateText :value="row.expiry_date" /><span class="block"><StatusBadge :status="row.expiry_status" :label="row.days_to_expiry <= 0 ? `Expired ${-row.days_to_expiry}d ago` : `${row.days_to_expiry} days left`" /></span></span>
          </div>
        </template>
        <template #cell-quantity="{ row }"><b>{{ number(row.quantity) }}</b></template>
        <template #cell-value="{ row }">{{ money(row.quantity * row.purchase_price) }}</template>
        <template #cell-supplier="{ row }"><span class="text-xs text-slate-500">{{ row.supplier }}</span></template>
      </DataTable>
      <AppPagination v-model="page" :meta="meta" />
    </div>
  </div>
</template>
