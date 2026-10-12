<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowUturnLeftIcon, InboxArrowDownIcon, LightBulbIcon, PaperAirplaneIcon, PencilSquareIcon, PlusIcon, QrCodeIcon, TrashIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { addDaysIso, money, phone } from '@/lib/format'
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
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const ui = useUiStore()
const { date, dateTime } = useFormat()
const canBuy = auth.can('purchasing.create')
const canProcess = auth.can('purchasing.update')
const canReturn = auth.can('returns.manage')

const tab = ref('orders')
const orders = useList('/purchase-orders', { status: '' }, { syncQuery: false })
const suppliers = useList('/suppliers', { search: '' }, { perPage: 100, syncQuery: false })
const returns = useList('/supplier-returns', { status: '' }, { syncQuery: false })
const stores = ref([])
onMounted(async () => (stores.value = (await api.get('/stores')).data.data))
const tabs = computed(() => [
  { value: 'orders', label: 'Purchase orders', count: orders.meta.value.total },
  { value: 'suppliers', label: 'Suppliers', count: suppliers.rows.value.length },
  { value: 'returns', label: 'Returns to supplier', count: returns.meta.value.total },
])
const SUPPLIER_TYPES = { epss: 'EPSS', manufacturer: 'Manufacturer', importer: 'Importer', wholesaler: 'Wholesaler', other: 'Other' }
const REASONS = { near_expiry: 'Near expiry', expired: 'Expired', damaged: 'Damaged', recall: 'Recall (EFDA)', wrong_item: 'Wrong item', other: 'Other' }

// ---- Purchase order creation (optionally from reorder suggestions)
const creating = ref(false)
const po = useForm({ supplier_id: '', store_id: '', expected_at: addDaysIso(3), notes: '', items: [] })
const itemSearch = ref('')
const itemResults = ref([])
watch(creating, (o) => o && po.reset({ supplier_id: suppliers.rows.value[0]?.id ?? '', store_id: '', expected_at: addDaysIso(3), notes: '', items: [] }))
let t1
watch(itemSearch, (q) => {
  clearTimeout(t1)
  t1 = setTimeout(async () => (itemResults.value = q.length < 2 ? [] : (await api.get('/inventory', { params: { search: q, per_page: 8 } })).data.data), 250)
})
function addPoItem(l) {
  if (!po.data.items.some((i) => i.id === l.id)) po.data.items.push({ id: l.id, name: l.medicine.display_name, quantity: 100, unit_cost: Math.round(l.price * 0.7 * 100) / 100 })
  itemSearch.value = ''
  itemResults.value = []
}
async function fromSuggestions() {
  const list = (await api.get('/purchase-orders/suggestions')).data.data
  if (!list.length) return ui.info('Nothing is below its reorder level right now.')
  creating.value = true
  setTimeout(() => {
    po.data.items = list.map((s) => ({ id: s.pharmacy_medicine_id, name: `${s.name} (${s.available} left)`, quantity: s.suggested_quantity, unit_cost: s.unit_cost }))
    po.data.notes = 'Reorder: items below reorder level'
  })
}
const poTotal = computed(() => po.data.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0))
async function savePo() {
  const payload = { ...po.data, store_id: po.data.store_id || null, items: po.data.items.map((i) => ({ pharmacy_medicine_id: i.id, quantity: i.quantity, unit_cost: i.unit_cost })) }
  await po.submit(() => api.post('/purchase-orders', payload), { onSuccess: () => { creating.value = false; orders.reload() } }).catch(() => {})
}

// ---- PO detail, send, receive (goods received note with GS1 scanning)
const viewing = ref(null)
const receiving = ref([])
const scan = ref('')
async function view(row) {
  viewing.value = (await api.get(`/purchase-orders/${row.id}`)).data.data
  receiving.value = viewing.value.items.filter((i) => i.outstanding > 0).map((i) => ({ item_id: i.id, name: i.medicine, gtin: i.gtin, quantity: i.outstanding, batch_number: '', expiry_date: '', unit_cost: i.unit_cost }))
}
async function poAction(action, body = {}) {
  try {
    const { data } = await api.post(`/purchase-orders/${viewing.value.id}/${action}`, body)
    ui.success(data.message)
    orders.reload()
    await view(viewing.value)
  } catch (e) {
    ui.error(e.message)
  }
}
/** Scanning a pack's GS1 DataMatrix fills batch and expiry on the matching line. */
async function onScan() {
  const code = scan.value.trim()
  scan.value = ''
  if (!code) return
  try {
    const { data } = await api.get('/scan', { params: { code } })
    const gs1 = data.data.gs1
    if (!gs1) return ui.error('Not a GS1 DataMatrix code.')
    const line = receiving.value.find((l) => data.data.listing && l.name === data.data.listing.medicine.display_name) ?? receiving.value.find((l) => l.gtin && gs1.gtin && l.gtin.replace(/^0+/, '') === gs1.gtin.replace(/^0+/, '')) ?? receiving.value.find((l) => !l.batch_number)
    if (!line) return ui.error('No open line for this product.')
    Object.assign(line, { batch_number: gs1.batch ?? line.batch_number, expiry_date: gs1.expiry ?? line.expiry_date, gtin: gs1.gtin ?? line.gtin })
    ui.success(`${line.name}: batch ${gs1.batch ?? '?'} · exp ${gs1.expiry ?? '?'}`)
  } catch (e) {
    ui.error(e.message)
  }
}
const receiveErrors = ref({})
async function receive() {
  const lines = receiving.value.filter((l) => l.quantity > 0 && l.batch_number && l.expiry_date).map(({ name, ...rest }) => rest)
  if (!lines.length) return ui.error('Enter batch number and expiry for at least one line.')
  receiveErrors.value = {}
  try {
    const { data } = await api.post(`/purchase-orders/${viewing.value.id}/receive`, { lines })
    ui.success(data.message)
    orders.reload()
    await view(viewing.value)
  } catch (e) {
    receiveErrors.value = e.errors
    ui.error(e.message)
  }
}

// ---- Suppliers
const editingSupplier = ref(null)
const sBlank = { name: '', type: 'wholesaler', tin_number: '', license_number: '', phone: '', email: '', contact_person: '', address: '', payment_terms_days: 30, is_active: true }
const sForm = useForm(sBlank)
watch(editingSupplier, (s) => s && sForm.reset(s.id ? { ...sBlank, ...s, phone: s.phone ? phone(s.phone) : '' } : sBlank))
async function saveSupplier() {
  const d = { ...sForm.data, tin_number: sForm.data.tin_number || null, phone: sForm.data.phone || null, email: sForm.data.email || null }
  const req = editingSupplier.value.id ? () => api.put(`/suppliers/${editingSupplier.value.id}`, d) : () => api.post('/suppliers', d)
  await sForm.submit(req, { onSuccess: () => { editingSupplier.value = null; suppliers.reload() } }).catch(() => {})
}

// ---- Supplier returns
const returning = ref(false)
const rForm = useForm({ batch_id: '', supplier_id: '', quantity: 1, reason: 'near_expiry', notes: '' })
const batchSearch = ref('')
const batchResults = ref([])
const pickedBatch = ref(null)
watch(returning, (o) => { if (o) { rForm.reset(); pickedBatch.value = null } })
let t2
watch(batchSearch, (q) => {
  clearTimeout(t2)
  t2 = setTimeout(async () => (batchResults.value = q.length < 2 ? [] : (await api.get('/batches', { params: { search: q, per_page: 8 } })).data.data.filter((b) => b.quantity > 0)), 250)
})
function pickBatch(b) {
  pickedBatch.value = b
  rForm.data.batch_id = b.id
  rForm.data.quantity = b.quantity
  if (b.expiry_status === 'expired') rForm.data.reason = 'expired'
  batchSearch.value = ''
  batchResults.value = []
}
async function saveReturn() {
  await rForm.submit(() => api.post('/supplier-returns', { ...rForm.data, supplier_id: rForm.data.supplier_id || null }), { onSuccess: () => { returning.value = false; returns.reload() } }).catch(() => {})
}
async function resolveReturn(r, status) {
  const credit = await ui.confirm({ title: status === 'credited' ? 'Supplier credited this return?' : 'Supplier rejected this return?', confirmText: 'Save', input: status === 'credited' ? { label: 'Credit note number', required: true } : undefined })
  if (!credit) return
  try {
    ui.success((await api.post(`/supplier-returns/${r.id}/resolve`, { status, credit_note_number: typeof credit === 'string' ? credit : null })).data.message)
    returns.reload()
  } catch (e) {
    ui.error(e.message)
  }
}

const poColumns = [{ key: 'number', label: 'PO' }, { key: 'supplier', label: 'Supplier' }, { key: 'total', label: 'Total', align: 'right' }, { key: 'expected', label: 'Expected' }, { key: 'status', label: 'Status' }]
const supplierColumns = [{ key: 'name', label: 'Supplier' }, { key: 'contact', label: 'Contact' }, { key: 'terms', label: 'Terms' }, { key: 'pos', label: 'POs', align: 'center' }, { key: 'actions', label: '', align: 'right' }]
const returnColumns = [{ key: 'number', label: 'Return' }, { key: 'medicine', label: 'Batch' }, { key: 'qty', label: 'Qty', align: 'right' }, { key: 'value', label: 'Value', align: 'right' }, { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status' }, { key: 'actions', label: '', align: 'right' }]
</script>

<template>
  <div>
    <PageHeader title="Purchasing" eyebrow="Stock & supply" subtitle="Order from EPSS and private suppliers, receive goods batch by batch (scan the GS1 DataMatrix), and send damaged or near-expiry stock back for credit.">
      <template v-if="tab === 'orders' && canBuy">
        <button class="btn btn-secondary" @click="fromSuggestions"><LightBulbIcon class="size-4" /> Reorder suggestions</button>
        <button class="btn btn-primary" @click="creating = true"><PlusIcon class="size-4" /> New purchase order</button>
      </template>
      <button v-if="tab === 'suppliers' && canBuy" class="btn btn-primary" @click="editingSupplier = {}"><PlusIcon class="size-4" /> Add supplier</button>
      <button v-if="tab === 'returns' && canReturn" class="btn btn-primary" @click="returning = true"><ArrowUturnLeftIcon class="size-4" /> New return</button>
    </PageHeader>
    <PillTabs v-model="tab" :tabs="tabs" class="mb-4" />

    <div v-if="tab === 'orders'" class="card overflow-hidden">
      <div class="border-b border-slate-100 p-4">
        <select v-model="orders.filters.status" class="input w-56"><option value="">All</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="partially_received">Part received</option><option value="received">Received</option><option value="cancelled">Cancelled</option></select>
      </div>
      <DataTable :columns="poColumns" :rows="orders.rows.value" :loading="orders.loading.value" clickable empty-title="No purchase orders" @row-click="view">
        <template #cell-number="{ row }"><span class="font-mono text-xs font-bold">{{ row.po_number }}</span><p class="text-xs text-slate-500">{{ row.items_count }} lines</p></template>
        <template #cell-supplier="{ row }">{{ row.supplier?.name }}</template>
        <template #cell-total="{ row }"><b>{{ money(row.total) }}</b></template>
        <template #cell-expected="{ row }"><span class="text-xs">{{ row.expected_at ? date(row.expected_at) : '—' }}</span></template>
        <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      </DataTable>
      <AppPagination v-model="orders.page.value" :meta="orders.meta.value" />
    </div>

    <div v-else-if="tab === 'suppliers'" class="card overflow-hidden">
      <div class="border-b border-slate-100 p-4"><SearchInput v-model="suppliers.filters.search" placeholder="Search suppliers" /></div>
      <DataTable :columns="supplierColumns" :rows="suppliers.rows.value" :loading="suppliers.loading.value" empty-title="No suppliers yet">
        <template #cell-name="{ row }"><p class="font-semibold" :class="!row.is_active && 'text-slate-400'">{{ row.name }}</p><p class="text-xs text-slate-500">{{ SUPPLIER_TYPES[row.type] }}<template v-if="row.tin_number"> · TIN {{ row.tin_number }}</template></p></template>
        <template #cell-contact="{ row }"><p class="text-sm">{{ row.contact_person || '—' }}</p><p class="text-xs text-slate-500">{{ row.phone ? phone(row.phone) : '' }}</p></template>
        <template #cell-terms="{ row }">{{ row.payment_terms_days ? `${row.payment_terms_days} days` : 'Cash' }}</template>
        <template #cell-pos="{ row }">{{ row.purchase_orders_count ?? '—' }}</template>
        <template #cell-actions="{ row }"><button v-if="canProcess" class="btn-icon size-8" @click="editingSupplier = row"><PencilSquareIcon class="size-4" /></button></template>
      </DataTable>
    </div>

    <div v-else class="card overflow-hidden">
      <DataTable :columns="returnColumns" :rows="returns.rows.value" :loading="returns.loading.value" empty-title="No returns">
        <template #cell-number="{ row }"><span class="font-mono text-xs font-bold">{{ row.return_number }}</span><p class="text-xs text-slate-500">{{ row.supplier || 'No supplier' }}</p></template>
        <template #cell-medicine="{ row }"><p class="text-sm font-semibold">{{ row.batch?.medicine }}</p><p class="font-mono text-xs text-slate-500">{{ row.batch?.batch_number }} · exp {{ row.batch?.expiry_date }}</p></template>
        <template #cell-qty="{ row }">{{ row.quantity }}</template>
        <template #cell-value="{ row }">{{ money(row.value) }}</template>
        <template #cell-reason="{ row }">{{ REASONS[row.reason] }}</template>
        <template #cell-status="{ row }"><StatusBadge :status="row.status" /><p v-if="row.credit_note_number" class="font-mono text-xs">{{ row.credit_note_number }}</p></template>
        <template #cell-actions="{ row }">
          <div v-if="canReturn && row.status === 'pending'" class="flex justify-end gap-1">
            <button class="btn btn-ghost btn-sm" @click="resolveReturn(row, 'rejected')">Rejected</button>
            <button class="btn btn-primary btn-sm" @click="resolveReturn(row, 'credited')">Credited</button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="returns.page.value" :meta="returns.meta.value" />
    </div>

    <!-- New PO -->
    <AppModal :open="creating" title="New purchase order" size="lg" @close="creating = false">
      <div class="grid gap-4 sm:grid-cols-3">
        <FormField label="Supplier" :error="po.errors.value.supplier_id"><select v-model="po.data.supplier_id" class="input"><option v-for="s in suppliers.rows.value" :key="s.id" :value="s.id">{{ s.name }}</option></select></FormField>
        <FormField label="Deliver to"><select v-model="po.data.store_id" class="input"><option value="">Default store</option><option v-for="s in stores" :key="s.id" :value="s.id">{{ s.name }}</option></select></FormField>
        <FormField label="Expected"><input v-model="po.data.expected_at" type="date" class="input" /></FormField>
        <div class="relative sm:col-span-3">
          <SearchInput v-model="itemSearch" placeholder="Add a medicine from your inventory…" />
          <ul v-if="itemResults.length" class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <li v-for="l in itemResults" :key="l.id"><button class="flex w-full justify-between px-4 py-2 text-left text-sm hover:bg-slate-50" @click="addPoItem(l)"><span>{{ l.medicine.display_name }}</span><span class="text-xs text-slate-500">{{ l.available_quantity }} in stock</span></button></li>
          </ul>
        </div>
        <div class="space-y-2 sm:col-span-3">
          <div v-for="(i, idx) in po.data.items" :key="i.id" class="grid grid-cols-[1fr_6rem_7rem_auto] items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <span class="truncate text-sm font-semibold">{{ i.name }}</span>
            <input v-model.number="i.quantity" type="number" min="1" class="input py-1" title="Quantity" />
            <input v-model.number="i.unit_cost" type="number" min="0" step="0.01" class="input py-1" title="Unit cost" />
            <button class="btn-icon size-8" @click="po.data.items.splice(idx, 1)"><TrashIcon class="size-4" /></button>
          </div>
          <p v-if="po.errors.value.items" class="field-error">{{ po.errors.value.items }}</p>
        </div>
        <FormField label="Notes" class="sm:col-span-3"><input v-model="po.data.notes" class="input" /></FormField>
      </div>
      <template #footer>
        <span class="mr-auto self-center text-lg font-extrabold">{{ money(poTotal) }}</span>
        <button class="btn btn-secondary" @click="creating = false">Cancel</button>
        <button class="btn btn-primary" :disabled="!po.data.items.length || po.processing.value" @click="savePo"><AppSpinner v-if="po.processing.value" /> Save draft</button>
      </template>
    </AppModal>

    <!-- PO detail / goods receipt -->
    <AppModal :open="!!viewing" :title="viewing?.po_number" :subtitle="viewing ? `${viewing.supplier?.name} · ${money(viewing.total)}` : ''" size="xl" @close="viewing = null">
      <div v-if="viewing" class="space-y-4">
        <div class="flex flex-wrap items-center gap-2 text-sm"><StatusBadge :status="viewing.status" /><span class="text-slate-500">Created {{ dateTime(viewing.created_at) }}<template v-if="viewing.created_by"> by {{ viewing.created_by }}</template></span></div>
        <table class="table text-sm">
          <thead><tr><th>Medicine</th><th class="text-right">Ordered</th><th class="text-right">Received</th><th class="text-right">Unit cost</th><th class="text-right">Line</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="i in viewing.items" :key="i.id"><td>{{ i.medicine }}</td><td class="text-right">{{ i.quantity_ordered }}</td><td class="text-right" :class="i.outstanding ? 'text-amber-700' : 'text-emerald-700'">{{ i.quantity_received }}</td><td class="text-right">{{ money(i.unit_cost, { symbol: '' }) }}</td><td class="text-right font-semibold">{{ money(i.line_total, { symbol: '' }) }}</td></tr>
          </tbody>
        </table>

        <div v-if="canProcess && ['sent', 'partially_received'].includes(viewing.status) && receiving.length" class="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
          <h3 class="flex items-center gap-2 font-bold text-slate-900"><InboxArrowDownIcon class="size-5 text-brand-600" /> Goods received note</h3>
          <form class="mt-3 flex gap-2" @submit.prevent="onScan">
            <div class="relative flex-1"><QrCodeIcon class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" /><input v-model="scan" class="input pl-10 font-mono" placeholder="Scan the pack's GS1 DataMatrix to fill batch & expiry" /></div>
            <button class="btn btn-secondary">Read</button>
          </form>
          <div class="mt-3 space-y-2">
            <div v-for="(l, idx) in receiving" :key="l.item_id" class="grid gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-200 sm:grid-cols-[1fr_5rem_9rem_9rem]">
              <span class="self-center text-sm font-semibold">{{ l.name }}</span>
              <input v-model.number="l.quantity" type="number" min="0" class="input py-1.5" title="Quantity received" />
              <input v-model="l.batch_number" class="input py-1.5 font-mono" placeholder="Batch no." />
              <input v-model="l.expiry_date" type="date" class="input py-1.5" />
              <p v-for="k in ['quantity', 'batch_number', 'expiry_date', 'item_id']" v-show="receiveErrors[`lines.${idx}.${k}`]" :key="k" class="field-error sm:col-span-4">{{ receiveErrors[`lines.${idx}.${k}`] }}</p>
            </div>
          </div>
        </div>
      </div>
      <template v-if="viewing && canProcess" #footer>
        <button v-if="['draft', 'sent'].includes(viewing.status)" class="btn btn-ghost mr-auto text-rose-600" @click="poAction('cancel')">Cancel PO</button>
        <button v-if="viewing.status === 'draft'" class="btn btn-primary" @click="poAction('send')"><PaperAirplaneIcon class="size-4" /> Mark as sent</button>
        <button v-if="['sent', 'partially_received'].includes(viewing.status)" class="btn btn-primary" @click="receive"><InboxArrowDownIcon class="size-4" /> Receive into stock</button>
      </template>
    </AppModal>

    <!-- Supplier -->
    <AppModal :open="!!editingSupplier" :title="editingSupplier?.id ? 'Edit supplier' : 'New supplier'" size="lg" @close="editingSupplier = null">
      <form id="supplier-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveSupplier">
        <FormField label="Name" :error="sForm.errors.value.name" required><input v-model="sForm.data.name" class="input" required /></FormField>
        <FormField label="Type"><select v-model="sForm.data.type" class="input"><option v-for="(l, v) in SUPPLIER_TYPES" :key="v" :value="v">{{ l }}</option></select></FormField>
        <FormField label="TIN" :error="sForm.errors.value.tin_number"><input v-model="sForm.data.tin_number" class="input font-mono" maxlength="10" /></FormField>
        <FormField label="EFDA licence no."><input v-model="sForm.data.license_number" class="input" /></FormField>
        <FormField label="Contact person"><input v-model="sForm.data.contact_person" class="input" /></FormField>
        <FormField label="Phone" :error="sForm.errors.value.phone"><input v-model="sForm.data.phone" class="input" /></FormField>
        <FormField label="Email" :error="sForm.errors.value.email"><input v-model="sForm.data.email" type="email" class="input" /></FormField>
        <FormField label="Payment terms (days)"><input v-model="sForm.data.payment_terms_days" type="number" min="0" class="input" /></FormField>
        <FormField label="Address" class="sm:col-span-2"><input v-model="sForm.data.address" class="input" /></FormField>
        <ToggleSwitch v-model="sForm.data.is_active" label="Active" />
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editingSupplier = null">Cancel</button>
        <button form="supplier-form" class="btn btn-primary" :disabled="sForm.processing.value"><AppSpinner v-if="sForm.processing.value" /> Save</button>
      </template>
    </AppModal>

    <!-- Return -->
    <AppModal :open="returning" title="Return stock to supplier" subtitle="The quantity leaves sellable stock immediately and is tracked until credited." @close="returning = false">
      <div class="space-y-4">
        <FormField label="Batch" :error="rForm.errors.value.batch_id">
          <div v-if="pickedBatch" class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span><b>{{ pickedBatch.listing?.medicine?.display_name ?? 'Batch' }}</b> <span class="font-mono">{{ pickedBatch.batch_number }}</span> · exp {{ pickedBatch.expiry_date }} · {{ pickedBatch.quantity }} on hand</span>
            <button class="text-xs font-semibold text-rose-600" @click="pickedBatch = null; rForm.data.batch_id = ''">change</button>
          </div>
          <div v-else class="relative">
            <SearchInput v-model="batchSearch" placeholder="Search medicine or batch number" />
            <ul v-if="batchResults.length" class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <li v-for="b in batchResults" :key="b.id"><button class="flex w-full justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50" @click="pickBatch(b)"><span>{{ b.listing?.medicine?.display_name }} <span class="font-mono text-xs">{{ b.batch_number }}</span></span><span class="text-xs" :class="b.expiry_status === 'ok' ? 'text-slate-500' : 'font-bold text-rose-600'">exp {{ b.expiry_date }} · {{ b.quantity }}</span></button></li>
            </ul>
          </div>
        </FormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="Quantity" :error="rForm.errors.value.quantity"><input v-model.number="rForm.data.quantity" type="number" min="1" class="input" /></FormField>
          <FormField label="Reason"><select v-model="rForm.data.reason" class="input"><option v-for="(l, v) in REASONS" :key="v" :value="v">{{ l }}</option></select></FormField>
          <FormField label="Supplier" class="sm:col-span-2"><select v-model="rForm.data.supplier_id" class="input"><option value="">Same as received from</option><option v-for="s in suppliers.rows.value" :key="s.id" :value="s.id">{{ s.name }}</option></select></FormField>
          <FormField label="Notes" class="sm:col-span-2"><input v-model="rForm.data.notes" class="input" /></FormField>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="returning = false">Cancel</button>
        <button class="btn btn-primary" :disabled="!rForm.data.batch_id || rForm.processing.value" @click="saveReturn"><AppSpinner v-if="rForm.processing.value" /> Record return</button>
      </template>
    </AppModal>
  </div>
</template>
