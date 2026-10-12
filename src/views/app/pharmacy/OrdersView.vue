<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { GlobeAltIcon, BuildingStorefrontIcon } from '@heroicons/vue/24/outline'
import { money, phone } from '@/lib/format'
import { useList } from '@/composables/useList'
import { useMetaStore } from '@/stores/meta'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'

const router = useRouter()
const meta = useMetaStore()
meta.load()
const { rows, meta: page, extra, loading, filters, page: current } = useList('/orders', { status: 'open', channel: '', search: '', from: '', to: '' }, { perPage: 20 })

const counts = computed(() => extra.value.counts ?? {})
const tabs = computed(() => [
  { value: 'open', label: 'Needs action', count: (counts.value.pending ?? 0) + (counts.value.confirmed ?? 0) + (counts.value.ready ?? 0) },
  { value: 'pending', label: 'New', count: counts.value.pending ?? 0 },
  { value: 'confirmed', label: 'Preparing', count: counts.value.confirmed ?? 0 },
  { value: 'ready', label: 'Ready', count: counts.value.ready ?? 0 },
  { value: 'completed', label: 'Completed' },
  { value: 'partially_completed', label: 'Partial' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: '', label: 'All' },
])

const columns = [
  { key: 'order', label: 'Order' },
  { key: 'customer', label: 'Customer' },
  { key: 'items', label: 'Items', align: 'center' },
  { key: 'payment', label: 'Payment' },
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total', align: 'right' },
]
</script>

<template>
  <div>
    <PageHeader title="Orders" eyebrow="Pharmacy" subtitle="Online reservations from customers and every counter sale. New orders also arrive as notifications.">
      <RouterLink :to="{ name: 'app.pos' }" class="btn btn-primary">New counter sale</RouterLink>
    </PageHeader>

    <div class="card overflow-hidden">
      <div class="space-y-4 border-b border-slate-100 p-4">
        <PillTabs v-model="filters.status" :tabs="tabs" />
        <div class="flex flex-col gap-3 lg:flex-row">
          <SearchInput v-model="filters.search" class="flex-1" placeholder="Order number, customer name or phone" />
          <select v-model="filters.channel" class="input lg:w-44">
            <option value="">All channels</option>
            <option value="online">Online</option>
            <option value="walk_in">Walk-in</option>
          </select>
          <input v-model="filters.from" type="date" class="input lg:w-40" aria-label="From date" />
          <input v-model="filters.to" type="date" class="input lg:w-40" aria-label="To date" />
        </div>
      </div>
      <DataTable :columns="columns" :rows="rows" :loading="loading" clickable empty-title="No orders here" empty-text="New online orders will appear in “Needs action”." @row-click="(o) => router.push({ name: 'app.order', params: { id: o.id } })">
        <template #cell-order="{ row }">
          <div class="flex items-center gap-3">
            <span class="grid size-9 place-items-center rounded-xl" :class="row.channel === 'online' ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'">
              <component :is="row.channel === 'online' ? GlobeAltIcon : BuildingStorefrontIcon" class="size-4.5" />
            </span>
            <div>
              <p class="font-mono text-xs font-bold text-slate-900">{{ row.order_number }}</p>
              <p class="text-xs text-slate-500"><DateText :value="row.created_at" time /></p>
            </div>
          </div>
        </template>
        <template #cell-customer="{ row }">
          <p class="font-semibold text-slate-800">{{ row.customer_name }}</p>
          <p class="text-xs text-slate-500">{{ row.customer_phone ? phone(row.customer_phone) : '' }}
            <span v-if="row.prescription" class="ml-1 font-mono font-semibold text-rose-600">{{ row.prescription.reference_code }}</span>
          </p>
        </template>
        <template #cell-items="{ row }">{{ row.items_count }}</template>
        <template #cell-payment="{ row }">
          <p class="text-sm">{{ meta.paymentLabel(row.payment_method) }}</p>
          <StatusBadge :status="row.payment_status" :dot="false" class="mt-0.5" />
        </template>
        <template #cell-status="{ row }">
          <StatusBadge :status="row.status" />
          <p v-if="row.fulfillment === 'delivery'" class="mt-0.5 text-xs font-semibold text-violet-600">🛵 Delivery</p>
        </template>
        <template #cell-total="{ row }"><b>{{ money(row.total_amount) }}</b></template>
      </DataTable>
      <AppPagination v-model="current" :meta="page" />
    </div>
  </div>
</template>
