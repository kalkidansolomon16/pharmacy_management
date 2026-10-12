<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowRightIcon, PencilSquareIcon, PlusIcon, TrashIcon, TruckIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, number } from '@/lib/format'
import { useFormat } from '@/composables/useFormat'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const ui = useUiStore()
const { dateTime } = useFormat()
const canAddStore = auth.can('stores.create')
const canEditStore = auth.can('stores.update')
const canTransfer = auth.can('transfers.manage')

const tab = ref('stores')
const stores = ref([])
const loadStores = async () => (stores.value = (await api.get('/stores')).data.data)
onMounted(loadStores)
const transfers = useList('/transfers', { status: '' }, { syncQuery: false })
const tabs = computed(() => [{ value: 'stores', label: 'Stores', count: stores.value.length }, { value: 'transfers', label: 'Transfers', count: transfers.meta.value.total }])
const TYPES = { main: 'Main store', dispensary: 'Dispensary', opd: 'OPD pharmacy', ward: 'Ward store', emergency: 'Emergency', other: 'Other' }

// Store form
const editing = ref(null)
const blank = { name: '', code: '', type: 'dispensary', is_dispensing: true, is_default: false }
const form = useForm(blank)
watch(editing, (s) => s && form.reset(s.id ? { ...blank, ...s } : blank))
async function saveStore() {
  const req = editing.value.id ? () => api.put(`/stores/${editing.value.id}`, form.data) : () => api.post('/stores', form.data)
  await form.submit(req, { onSuccess: () => { editing.value = null; loadStores() } }).catch(() => {})
}

// New transfer
const creating = ref(false)
const tForm = useForm({ from_store_id: '', to_store_id: '', notes: '', items: [] })
const search = ref('')
const results = ref([])
watch(creating, (o) => o && tForm.reset({ from_store_id: stores.value.find((s) => s.type === 'main')?.id ?? '', to_store_id: stores.value.find((s) => s.is_default)?.id ?? '', notes: '', items: [] }))
let timer
watch(search, (q) => {
  clearTimeout(timer)
  timer = setTimeout(async () => (results.value = q.length < 2 ? [] : (await api.get('/inventory', { params: { search: q, per_page: 8 } })).data.data), 250)
})
function addItem(l) {
  if (!tForm.data.items.some((i) => i.listing.id === l.id)) tForm.data.items.push({ listing: l, quantity: 10 })
  search.value = ''
  results.value = []
}
async function createTransfer() {
  const payload = { ...tForm.data, items: tForm.data.items.map((i) => ({ pharmacy_medicine_id: i.listing.id, quantity: i.quantity })) }
  await tForm.submit(() => api.post('/transfers', payload), { onSuccess: () => { creating.value = false; tab.value = 'transfers'; transfers.reload() } }).catch(() => {})
}

// Transfer detail & lifecycle
const viewing = ref(null)
async function view(t) {
  viewing.value = (await api.get(`/transfers/${t.id}`)).data.data
}
async function act(t, action, confirm) {
  if (confirm && !(await ui.confirm(confirm))) return
  try {
    const { data } = await api.post(`/transfers/${t.id}/${action}`)
    ui.success(data.message)
    if (viewing.value) viewing.value = data.data
    transfers.reload()
    loadStores()
  } catch (e) {
    ui.error(e.message)
  }
}

const storeColumns = [{ key: 'name', label: 'Store' }, { key: 'type', label: 'Type' }, { key: 'units', label: 'Units', align: 'right' }, { key: 'value', label: 'Stock value (cost)', align: 'right' }, { key: 'actions', label: '', align: 'right' }]
const transferColumns = [{ key: 'number', label: 'Transfer' }, { key: 'route', label: 'From → To' }, { key: 'items', label: 'Lines', align: 'center' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Requested' }]
</script>

<template>
  <div>
    <PageHeader title="Stores & transfers" eyebrow="Stock & supply" subtitle="Main medical store, OPD / ward / emergency dispensaries. Transfers pick the earliest-expiring batches first (FEFO) and keep batch numbers traceable.">
      <button v-if="canAddStore && tab === 'stores'" class="btn btn-secondary" @click="editing = {}"><PlusIcon class="size-4" /> Add store</button>
      <button v-if="canTransfer && stores.length > 1" class="btn btn-primary" @click="creating = true"><TruckIcon class="size-4" /> New transfer</button>
    </PageHeader>
    <PillTabs v-model="tab" :tabs="tabs" class="mb-4" />

    <div v-if="tab === 'stores'" class="card overflow-hidden">
      <DataTable :columns="storeColumns" :rows="stores" empty-title="No stores yet">
        <template #cell-name="{ row }"><p class="font-semibold">{{ row.name }} <span v-if="row.is_default" class="chip ml-1 bg-brand-50 text-brand-700 ring-brand-600/15">Default for sales</span></p><p class="font-mono text-xs text-slate-500">{{ row.code }}</p></template>
        <template #cell-type="{ row }">{{ TYPES[row.type] }}<p class="text-xs text-slate-500">{{ row.is_dispensing ? 'Dispenses to patients' : 'Storage only' }}</p></template>
        <template #cell-units="{ row }">{{ row.units != null ? number(row.units) : '—' }}</template>
        <template #cell-value="{ row }"><b>{{ row.stock_value != null ? money(row.stock_value) : '—' }}</b></template>
        <template #cell-actions="{ row }"><button v-if="canEditStore" class="btn-icon size-8" @click="editing = row"><PencilSquareIcon class="size-4" /></button></template>
      </DataTable>
    </div>

    <div v-else class="card overflow-hidden">
      <div class="border-b border-slate-100 p-4">
        <select v-model="transfers.filters.status" class="input w-52"><option value="">All</option><option value="requested">Requested</option><option value="dispatched">In transit</option><option value="received">Received</option><option value="cancelled">Cancelled</option></select>
      </div>
      <DataTable :columns="transferColumns" :rows="transfers.rows.value" :loading="transfers.loading.value" clickable empty-title="No transfers" @row-click="view">
        <template #cell-number="{ row }"><span class="font-mono text-xs font-bold">{{ row.transfer_number }}</span></template>
        <template #cell-route="{ row }"><span class="flex items-center gap-1.5 text-sm">{{ row.from_store?.name }} <ArrowRightIcon class="size-3.5 text-slate-400" /> {{ row.to_store?.name }}</span></template>
        <template #cell-items="{ row }">{{ row.items_count ?? row.items?.length }}</template>
        <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
        <template #cell-date="{ row }"><span class="text-xs">{{ dateTime(row.created_at) }}<template v-if="row.requested_by"> · {{ row.requested_by }}</template></span></template>
      </DataTable>
      <AppPagination v-model="transfers.page.value" :meta="transfers.meta.value" />
    </div>

    <AppModal :open="!!editing" :title="editing?.id ? 'Edit store' : 'New store'" @close="editing = null">
      <form id="store-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveStore">
        <FormField label="Name" :error="form.errors.value.name" required><input v-model="form.data.name" class="input" required /></FormField>
        <FormField label="Code" :error="form.errors.value.code" required><input v-model="form.data.code" class="input font-mono uppercase" required /></FormField>
        <FormField label="Type" class="sm:col-span-2"><select v-model="form.data.type" class="input"><option v-for="(l, v) in TYPES" :key="v" :value="v">{{ l }}</option></select></FormField>
        <ToggleSwitch v-model="form.data.is_dispensing" label="Dispenses to patients" description="Sales and prescriptions can draw stock from here" class="sm:col-span-2" />
        <ToggleSwitch v-model="form.data.is_default" label="Default store for counter sales" class="sm:col-span-2" />
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editing = null">Cancel</button>
        <button form="store-form" class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Save</button>
      </template>
    </AppModal>

    <AppModal :open="creating" title="Request a transfer" size="lg" @close="creating = false">
      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="From" :error="tForm.errors.value.from_store_id"><select v-model="tForm.data.from_store_id" class="input"><option v-for="s in stores" :key="s.id" :value="s.id">{{ s.name }}</option></select></FormField>
        <FormField label="To" :error="tForm.errors.value.to_store_id"><select v-model="tForm.data.to_store_id" class="input"><option v-for="s in stores" :key="s.id" :value="s.id">{{ s.name }}</option></select></FormField>
        <div class="relative sm:col-span-2">
          <SearchInput v-model="search" placeholder="Add a medicine…" />
          <ul v-if="results.length" class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <li v-for="l in results" :key="l.id"><button class="flex w-full justify-between px-4 py-2 text-left text-sm hover:bg-slate-50" @click="addItem(l)"><span>{{ l.medicine.display_name }}</span><span class="text-xs text-slate-500">{{ l.available_quantity }} total in stock</span></button></li>
          </ul>
        </div>
        <div class="space-y-2 sm:col-span-2">
          <div v-for="(i, idx) in tForm.data.items" :key="i.listing.id" class="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
            <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ i.listing.medicine.display_name }}</span>
            <input v-model.number="i.quantity" type="number" min="1" class="input w-24 py-1" />
            <button class="btn-icon size-8" @click="tForm.data.items.splice(idx, 1)"><TrashIcon class="size-4" /></button>
          </div>
          <p v-if="tForm.errors.value.items" class="field-error">{{ tForm.errors.value.items }}</p>
        </div>
        <FormField label="Notes" class="sm:col-span-2"><input v-model="tForm.data.notes" class="input" placeholder="e.g. Weekly OPD top-up" /></FormField>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="creating = false">Cancel</button>
        <button class="btn btn-primary" :disabled="!tForm.data.items.length || tForm.processing.value" @click="createTransfer"><AppSpinner v-if="tForm.processing.value" /> Request transfer</button>
      </template>
    </AppModal>

    <AppModal :open="!!viewing" :title="viewing?.transfer_number" :subtitle="viewing ? `${viewing.from_store?.name} → ${viewing.to_store?.name}` : ''" size="lg" @close="viewing = null">
      <div v-if="viewing" class="space-y-3">
        <StatusBadge :status="viewing.status" />
        <div v-for="i in viewing.items" :key="i.id" class="rounded-xl border border-slate-200 p-3">
          <p class="flex justify-between text-sm font-semibold"><span>{{ i.medicine }}</span><span>{{ i.dispatched_quantity ?? 0 }} / {{ i.quantity }}</span></p>
          <ul v-if="i.allocations.length" class="mt-2 space-y-1 text-xs text-slate-600">
            <li v-for="a in i.allocations" :key="a.batch_id" class="flex justify-between rounded-lg bg-slate-50 px-2 py-1"><span class="font-mono">{{ a.batch_number }}</span><span>exp {{ a.expiry_date }}</span><b>{{ a.quantity }}</b></li>
          </ul>
        </div>
      </div>
      <template v-if="viewing && canTransfer" #footer>
        <button v-if="['requested', 'dispatched'].includes(viewing.status)" class="btn btn-ghost mr-auto text-rose-600" @click="act(viewing, 'cancel', { title: 'Cancel transfer?', message: viewing.status === 'dispatched' ? 'Stock returns to the source store.' : '', danger: true, confirmText: 'Cancel transfer' })">Cancel transfer</button>
        <button v-if="viewing.status === 'requested'" class="btn btn-primary" @click="act(viewing, 'dispatch')"><TruckIcon class="size-4" /> Dispatch (FEFO pick)</button>
        <button v-if="viewing.status === 'dispatched'" class="btn btn-primary" @click="act(viewing, 'receive')">Confirm received</button>
      </template>
    </AppModal>
  </div>
</template>
