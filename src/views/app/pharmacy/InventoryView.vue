<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDownTrayIcon, ArrowPathIcon, EyeSlashIcon, PencilSquareIcon, PlusIcon, TruckIcon } from '@heroicons/vue/24/outline'
import api, { download } from '@/lib/api'
import { money } from '@/lib/format'
import { useList } from '@/composables/useList'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import StockMeter from '@/components/inventory/StockMeter.vue'
import ListingFormModal from '@/components/inventory/ListingFormModal.vue'
import ReceiveStockModal from '@/components/inventory/ReceiveStockModal.vue'

const auth = useAuthStore()
const meta = useMetaStore()
const ui = useUiStore()
const router = useRouter()
const canAdd = auth.can('inventory.create')
const canEdit = auth.can('inventory.update')
const canStock = auth.can('inventory.stock')

const { rows, meta: page, loading, filters, page: current, reload } = useList('/inventory', { search: '', filter: '', category_id: '' }, { perPage: 20 })
const alerts = ref(null)
const editing = ref(null)
const adding = ref(false)
const receiving = ref(null)
const scanning = ref(false)

async function loadAlerts() {
  alerts.value = (await api.get('/inventory/alerts')).data.data
}
onMounted(() => {
  meta.load()
  loadAlerts()
})

const columns = [
  { key: 'medicine', label: 'Medicine' },
  { key: 'price', label: 'Price', align: 'right' },
  { key: 'stock', label: 'Stock / reorder' },
  { key: 'status', label: 'Status' },
  { key: 'expiry', label: 'Next expiry' },
  { key: 'actions', label: '', align: 'right' },
]

function saved() {
  adding.value = false
  editing.value = null
  receiving.value = null
  reload()
  loadAlerts()
}

async function scan() {
  scanning.value = true
  try {
    const { data } = await api.post('/inventory/scan')
    ui.success(data.message)
    saved()
  } catch (e) {
    ui.error(e.message)
  } finally {
    scanning.value = false
  }
}

const exportAs = (format) => download('/reports/inventory/export', { format }).catch((e) => ui.error(e.message))
</script>

<template>
  <div>
    <PageHeader title="Inventory" eyebrow="Pharmacy" subtitle="Your medicines, prices and stock levels. Sales always use the batch that expires first.">
      <DropdownMenu width="w-44">
        <template #trigger><button class="btn btn-secondary"><ArrowDownTrayIcon class="size-4" /> Export</button></template>
        <button class="block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50" @click="exportAs('csv')">Excel (CSV)</button>
        <button class="block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50" @click="exportAs('pdf')">PDF valuation</button>
      </DropdownMenu>
      <button v-if="canStock" class="btn btn-secondary" :disabled="scanning" title="Write off expired batches and send alerts" @click="scan">
        <AppSpinner v-if="scanning" /><ArrowPathIcon v-else class="size-4" /> Run expiry scan
      </button>
      <button v-if="canAdd" class="btn btn-primary" @click="adding = true"><PlusIcon class="size-4" /> Add medicine</button>
    </PageHeader>

    <div v-if="alerts?.expired_with_stock_count" class="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">
      <span><b>{{ alerts.expired_with_stock_count }} expired batch(es)</b> are still counted on the shelf. They can't be sold - run the expiry scan to write them off.</span>
      <button v-if="canStock" class="btn btn-danger btn-sm" @click="scan">Write off now</button>
    </div>

    <div class="card overflow-hidden">
      <div class="space-y-4 border-b border-slate-100 p-4">
        <PillTabs
          v-model="filters.filter"
          :tabs="[
            { value: '', label: 'All' },
            { value: 'in_stock', label: 'Healthy' },
            { value: 'low_stock', label: 'Low stock', count: alerts ? alerts.low_stock_count - alerts.out_of_stock_count : null },
            { value: 'out_of_stock', label: 'Out of stock', count: alerts?.out_of_stock_count },
            { value: 'expiring', label: 'Expiring ≤ 90d', count: alerts?.expiring_count },
            { value: 'hidden', label: 'Hidden' },
          ]"
        />
        <div class="flex flex-col gap-3 sm:flex-row">
          <SearchInput v-model="filters.search" class="flex-1" placeholder="Search by name, brand, manufacturer or barcode" />
          <select v-model="filters.category_id" class="input sm:w-56">
            <option value="">All categories</option>
            <option v-for="c in meta.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
      </div>

      <DataTable :columns="columns" :rows="rows" :loading="loading" clickable empty-title="No medicines found" empty-text="Adjust your filters or add a medicine from the catalogue." @row-click="(r) => router.push({ name: 'app.inventory.item', params: { id: r.id } })">
        <template #cell-medicine="{ row }">
          <div class="flex items-center gap-3">
            <MedicineAvatar :form="row.medicine.dosage_form" size="sm" />
            <div class="min-w-0">
              <p class="flex items-center gap-1.5 font-semibold text-slate-900">
                <span class="truncate">{{ row.medicine.display_name }}</span>
                <EyeSlashIcon v-if="!row.is_public" class="size-4 shrink-0 text-slate-400" title="Hidden from customers" />
                <span v-if="row.medicine.prescription_required" class="chip bg-rose-50 px-1.5 text-[0.65rem] text-rose-700 ring-rose-600/15">Rx</span>
              </p>
              <p class="truncate text-xs text-slate-500">{{ row.medicine.dosage_form }} · {{ row.medicine.category?.name }}</p>
            </div>
          </div>
        </template>
        <template #cell-price="{ row }"><span class="font-semibold">{{ money(row.price) }}</span></template>
        <template #cell-stock="{ row }"><StockMeter :quantity="row.available_quantity ?? 0" :reorder="row.reorder_level" /></template>
        <template #cell-status="{ row }"><StatusBadge :status="row.stock_status" /></template>
        <template #cell-expiry="{ row }"><DateText :value="row.nearest_expiry" /></template>
        <template #cell-actions="{ row }">
          <div v-if="canStock || canEdit" class="flex justify-end gap-1" @click.stop>
            <button v-if="canStock" class="btn btn-ghost btn-sm" title="Receive stock" @click="receiving = row"><TruckIcon class="size-4" /> Receive</button>
            <button v-if="canEdit" class="btn-icon size-8" title="Edit price" @click="editing = row"><PencilSquareIcon class="size-4" /></button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="current" :meta="page" />
    </div>

    <ListingFormModal :open="adding || !!editing" :listing="editing" @close="adding = false; editing = null" @saved="saved" />
    <ReceiveStockModal :open="!!receiving" :listing="receiving" @close="receiving = null" @saved="saved" />
  </div>
</template>
