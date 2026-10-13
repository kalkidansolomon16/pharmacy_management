<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowPathIcon, BanknotesIcon, CheckCircleIcon, ClockIcon, DocumentTextIcon, PlusIcon, PrinterIcon, ReceiptRefundIcon, ShieldCheckIcon, TrashIcon,
} from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, todayIso } from '@/lib/format'
import { useFormat } from '@/composables/useFormat'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import StatCard from '@/components/ui/StatCard.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import InvoiceReceipt from '@/components/billing/InvoiceReceipt.vue'
import PatientPicker from '@/components/clinical/PatientPicker.vue'

const route = useRoute()
const auth = useAuthStore()
const meta = useMetaStore()
const ui = useUiStore()
const { dateTime } = useFormat()
meta.load()

const { rows, meta: pageMeta, extra, loading, filters, page, reload } = useList('/invoices', { status: 'unpaid', fiscal: '', from: '', search: route.query.search ?? '' })
const summary = computed(() => extra.value)
// Pharmacies that take payments at the cashier: counter sales the pharmacist sent over
const counterMode = computed(() => auth.hasModule('pharmacy') && !!auth.tenant?.settings?.pay_at_cashier && auth.can('billing.collect'))
const counter = reactive({ rows: [], loading: false, current: null, method: 'cash', reference: '', paying: false })
async function loadCounter() {
  if (!counterMode.value) return
  counter.loading = true
  try {
    counter.rows = (await api.get('/pos/counter-sales')).data.data
  } finally {
    counter.loading = false
  }
}
function openCounter(order) {
  Object.assign(counter, { current: order, method: 'cash', reference: '' })
}
async function collectCounter() {
  counter.paying = true
  try {
    const { data } = await api.post(`/pos/counter-sales/${counter.current.id}/pay`, { method: counter.method, reference: counter.reference || null })
    ui.success(data.message)
    counter.current = null
    loadCounter()
    reload()
    if (data.data.invoice?.id) open({ id: data.data.invoice.id }) // the fiscal receipt, ready to print
  } catch (e) {
    ui.error(e.message)
  } finally {
    counter.paying = false
  }
}
const counterNeedsReference = computed(() => !['cash', 'insurance', 'credit'].includes(counter.method))
let counterTimer
onMounted(() => {
  loadCounter()
  counterTimer = setInterval(loadCounter, 15000)
})
onBeforeUnmount(() => clearInterval(counterTimer))

const tab = ref(counterMode.value ? 'counter' : filters.fiscal ? 'fiscal' : filters.from ? 'today' : filters.status || 'all')
const tabs = computed(() => [
  ...(counterMode.value ? [{ value: 'counter', label: 'Pharmacy counter', count: counter.rows.length }] : []),
  { value: 'unpaid', label: 'To collect', count: summary.value.unpaid_count },
  { value: 'awaiting_approval', label: 'Awaiting insurer', count: summary.value.awaiting_approval },
  { value: 'today', label: "Today's invoices", count: summary.value.today?.invoices },
  { value: 'fiscal', label: 'e-Invoice queue', count: summary.value.fiscal_pending },
  { value: 'all', label: 'All' },
])
watch(tab, (t) => {
  if (t === 'counter') return loadCounter()
  Object.assign(filters, { status: ['unpaid', 'awaiting_approval'].includes(t) ? t : '', from: t === 'today' ? todayIso() : '', fiscal: t === 'fiscal' ? 'pending' : '' })
})

// Invoice detail & payment
const current = ref(null)
const pay = reactive({ amount: 0, method: 'cash', reference: '' })
const paying = ref(false)
async function open(row) {
  current.value = (await api.get(`/invoices/${row.id}`)).data.data
  Object.assign(pay, { amount: current.value.patient_balance, method: 'cash', reference: '' })
}
async function takePayment() {
  paying.value = true
  try {
    const { data } = await api.post(`/invoices/${current.value.id}/payments`, { ...pay, reference: pay.reference || null })
    ui.success(data.message)
    current.value = data.data
    pay.amount = current.value.patient_balance
    reload()
  } catch (e) {
    ui.error(e.message)
  } finally {
    paying.value = false
  }
}
async function voidInvoice() {
  const reason = await ui.confirm({ title: 'Void this invoice?', message: 'A credit note is issued and registered with the Ministry of Revenue.', confirmText: 'Void invoice', danger: true, input: { label: 'Reason', required: true } })
  if (!reason) return
  try {
    const { data } = await api.post(`/invoices/${current.value.id}/void`, { reason })
    ui.success(data.message)
    current.value = null
    reload()
  } catch (e) {
    ui.error(e.message)
  }
}
async function registerFiscal(row = current.value) {
  try {
    const { data } = await api.post(`/invoices/${row.id}/fiscal`)
    data.data.fiscal.status === 'accepted' ? ui.success(data.message) : ui.error(data.message)
    if (current.value?.id === row.id) current.value = { ...current.value, ...data.data }
    reload()
  } catch (e) {
    ui.error(e.message)
  }
}
const printNow = () => window.print()
const needsReference = computed(() => !['cash', 'insurance', 'credit'].includes(pay.method))

// New manual invoice (procedures, certificates, other charges)
const creating = ref(false)
const services = ref([])
const newPatient = ref(null)
const memberships = ref([])
const newInvoice = useForm({ customer_name: '', customer_phone: '', customer_tin: '', membership_id: '', discount: 0, lines: [] })
watch(creating, async (o) => {
  if (!o) return
  newInvoice.reset()
  newPatient.value = null
  if (!services.value.length) {
    try {
      services.value = (await api.get('/services', { params: { per_page: 100 } })).data.data.filter((s) => s.is_active)
    } catch {
      services.value = [] // no price list for this organization / role
    }
  }
  addLine()
})
// Pharmacies have no patient register; hospitals & clinics pick the patient
const hasPatients = computed(() => auth.hasModule('clinical') && auth.can('patients.view'))
/** One-click examples of things that are not medicines (medicines are invoiced automatically by the POS). */
const examples = computed(() => (auth.hasModule('clinical')
  ? ['Medical certificate', 'Wound dressing', 'Injection administration', 'Ambulance transport']
  : ['Blood pressure check', 'Blood sugar (glucose) test', 'Injection service', 'Home delivery fee']))
function useExample(text) {
  const empty = newInvoice.data.lines.find((l) => !l.service_id && !l.description)
  if (empty) empty.description = text
  else newInvoice.data.lines.push({ service_id: '', description: text, quantity: 1, unit_price: '', tax_category: 'exempt' })
}
watch(newPatient, async (p) => {
  memberships.value = p && auth.hasModule('insurance') ? (await api.get('/memberships', { params: { patient_id: p.id } })).data.data.filter((m) => m.is_valid) : []
  newInvoice.data.membership_id = memberships.value[0]?.id ?? ''
})
const addLine = () => newInvoice.data.lines.push({ service_id: '', description: '', quantity: 1, unit_price: '', tax_category: 'exempt' })
const linePrice = (l) => (l.service_id ? services.value.find((s) => s.id === l.service_id)?.price ?? 0 : Number(l.unit_price || 0))
const missingName = computed(() => !newPatient.value && !newInvoice.data.customer_name.trim())
const newTotal = computed(() => newInvoice.data.lines.reduce((s, l) => s + linePrice(l) * Number(l.quantity || 0), 0) - Number(newInvoice.data.discount || 0))
async function createInvoice() {
  const d = newInvoice.data
  const payload = {
    patient_id: newPatient.value?.id ?? null,
    customer_name: newPatient.value ? null : d.customer_name,
    customer_phone: newPatient.value ? null : d.customer_phone || null,
    customer_tin: d.customer_tin || null,
    membership_id: d.membership_id || null,
    discount: d.discount || 0,
    lines: d.lines.map((l) => (l.service_id ? { service_id: l.service_id, quantity: l.quantity } : { description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_category: l.tax_category, item_type: 'other' })),
  }
  await newInvoice.submit(() => api.post('/invoices', payload), {
    onSuccess: (res) => {
      creating.value = false
      reload()
      open(res.data)
    },
  }).catch(() => {})
}

const columns = [
  { key: 'number', label: 'Invoice' }, { key: 'customer', label: 'Customer' }, { key: 'total', label: 'Total', align: 'right' },
  { key: 'due', label: 'Patient due', align: 'right' }, { key: 'status', label: 'Status' }, { key: 'fiscal', label: 'e-Invoice' },
]
</script>

<template>
  <div>
    <PageHeader title="Cashier & invoices" eyebrow="Billing" subtitle="Collect payments (cash, telebirr, CBE Birr, M-Pesa…), print fiscal receipts and follow up e-invoice registration with the Ministry of Revenue.">
      <button class="btn btn-secondary" @click="reload"><ArrowPathIcon class="size-4" :class="loading && 'animate-spin'" /></button>
      <button v-if="auth.can('billing.create')" class="btn btn-primary" @click="creating = true"><PlusIcon class="size-4" /> New invoice</button>
    </PageHeader>

    <div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Collected today" :value="money(summary.today?.collected ?? 0)" :icon="BanknotesIcon" />
      <StatCard label="Invoiced today" :value="money(summary.today?.total ?? 0)" :hint="`${summary.today?.invoices ?? 0} invoices`" :icon="DocumentTextIcon" tone="sky" />
      <StatCard label="Waiting to pay" :value="String(summary.unpaid_count ?? 0)" :icon="ClockIcon" tone="gold" />
      <StatCard label="e-Invoice queue" :value="String(summary.fiscal_pending ?? 0)" hint="pending / rejected at MoR" :icon="ShieldCheckIcon" :tone="summary.fiscal_pending ? 'rose' : 'violet'" />
    </div>

    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <PillTabs v-model="tab" :tabs="tabs" />
      <SearchInput v-model="filters.search" placeholder="Invoice no., name or phone" class="w-72" />
    </div>

    <!-- Counter sales waiting for payment (pay-at-cashier pharmacies) -->
    <div v-if="tab === 'counter'" class="card overflow-hidden">
      <ul class="divide-y divide-slate-100">
        <li v-for="o in counter.rows" :key="o.id" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div class="min-w-0">
            <p><b class="font-mono text-lg">{{ o.order_number }}</b> <span class="ml-1 text-sm text-slate-600">{{ o.customer_name }}</span></p>
            <p class="truncate text-xs text-slate-500">{{ (o.items ?? []).map((i) => `${i.medicine?.display_name ?? ''} ×${i.quantity}`).join(', ') }}</p>
            <p class="text-xs text-slate-400">Sent {{ dateTime(o.created_at) }}<template v-if="o.created_by"> by {{ o.created_by }}</template></p>
          </div>
          <div class="flex items-center gap-3">
            <b class="text-xl">{{ money(o.total_amount) }}</b>
            <button class="btn btn-primary" @click="openCounter(o)"><BanknotesIcon class="size-4" /> Collect</button>
          </div>
        </li>
        <li v-if="!counter.rows.length" class="px-5 py-12 text-center text-sm text-slate-500">{{ counter.loading ? 'Loading…' : 'No customers waiting. Sales the pharmacist sends appear here automatically.' }}</li>
      </ul>
    </div>

    <div v-else class="card overflow-hidden">
      <DataTable :columns="columns" :rows="rows" :loading="loading" clickable empty-title="Nothing to collect" @row-click="open">
        <template #cell-number="{ row }">
          <p class="font-mono text-xs font-bold">{{ row.invoice_number }}</p>
          <p class="text-xs text-slate-500">{{ dateTime(row.issued_at) }}</p>
        </template>
        <template #cell-customer="{ row }">
          <p class="font-semibold">{{ row.customer_name || 'Walk-in' }}</p>
          <p v-if="row.payer" class="text-xs text-sky-700">{{ row.payer.name }}</p>
        </template>
        <template #cell-total="{ row }">{{ money(row.total) }}<p v-if="row.tax_total" class="text-xs text-slate-400">incl. tax {{ money(row.tax_total) }}</p></template>
        <template #cell-due="{ row }"><b :class="row.patient_balance > 0 ? 'text-rose-600' : 'text-emerald-700'">{{ money(row.patient_balance) }}</b></template>
        <template #cell-status="{ row }"><StatusBadge :status="row.document_type === 'credit_note' ? 'refunded' : row.status" :label="row.document_type === 'credit_note' ? 'Credit note' : ''" /></template>
        <template #cell-fiscal="{ row }">
          <div class="flex items-center gap-1">
            <StatusBadge :status="row.fiscal.status" />
            <button v-if="['pending', 'failed'].includes(row.fiscal.status) && auth.can('billing.collect')" class="btn btn-ghost btn-sm" title="Send to MoR now" @click.stop="registerFiscal(row)"><ArrowPathIcon class="size-4" /></button>
          </div>
          <p v-if="row.fiscal.error" class="max-w-40 truncate text-[0.68rem] text-rose-600" :title="row.fiscal.error">{{ row.fiscal.error }}</p>
        </template>
      </DataTable>
      <AppPagination v-model="page" :meta="pageMeta" />
    </div>

    <AppModal :open="!!counter.current" :title="`Collect ${counter.current?.order_number ?? ''}`" :subtitle="counter.current?.customer_name" size="sm" @close="counter.current = null">
      <div v-if="counter.current" class="space-y-4">
        <ul class="space-y-1 text-sm">
          <li v-for="i in counter.current.items" :key="i.id" class="flex justify-between"><span>{{ i.medicine?.display_name }} ×{{ i.quantity }}</span><span>{{ money(i.line_total) }}</span></li>
        </ul>
        <p class="flex items-end justify-between border-t border-dashed border-slate-300 pt-3"><span class="text-sm text-slate-500">To pay</span><b class="text-3xl">{{ money(counter.current.total_amount) }}</b></p>
        <div class="grid grid-cols-3 gap-1.5">
          <button v-for="m in meta.paymentMethods" :key="m.value" class="rounded-xl border px-2 py-2 text-xs font-bold transition" :class="counter.method === m.value ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600'" @click="counter.method = m.value">{{ m.label.replace('Health insurance (CBHI / EHIS)', 'Insurance') }}</button>
        </div>
        <input v-if="counterNeedsReference" v-model="counter.reference" class="input font-mono" placeholder="Transaction reference (e.g. telebirr ID)" />
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="counter.current = null">Cancel</button>
        <button class="btn btn-primary" :disabled="counter.paying" @click="collectCounter"><AppSpinner v-if="counter.paying" /> Paid - issue receipt</button>
      </template>
    </AppModal>

    <!-- Invoice detail -->
    <AppModal :open="!!current" :title="current?.invoice_number" :subtitle="current?.customer_name" size="xl" @close="current = null">
      <div v-if="current" class="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div class="space-y-5">
          <div v-if="current.status === 'awaiting_approval'" class="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">
            <b>Waiting for {{ current.payer?.name }} approval.</b> The insurance desk records the approval in Claims → Approvals; then the patient can pay their co-pay.
          </div>
          <table class="table text-sm">
            <thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th><th v-if="current.payer" class="text-right">Insurer</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="i in current.items" :key="i.id">
                <td>{{ i.description }}<span v-if="i.tax_rate" class="ml-1 text-xs text-slate-400">+{{ (i.tax_rate * 100).toFixed(0) }}% tax</span><span v-if="current.payer && !i.covered" class="ml-1 text-xs font-semibold text-amber-600">not covered</span></td>
                <td class="text-right">{{ Number(i.quantity) }}</td>
                <td class="text-right">{{ money(i.unit_price, { symbol: '' }) }}</td>
                <td class="text-right font-semibold">{{ money(i.line_total, { symbol: '' }) }}</td>
                <td v-if="current.payer" class="text-right text-sky-700">{{ money(i.payer_amount, { symbol: '' }) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">Total</p><p class="text-lg font-extrabold">{{ money(current.total) }}</p></div>
            <div class="rounded-xl bg-sky-50 p-3"><p class="text-xs text-sky-700">Insurer / credit</p><p class="text-lg font-extrabold text-sky-800">{{ money(current.payer_share) }}</p></div>
            <div class="rounded-xl p-3" :class="current.patient_balance > 0 ? 'bg-rose-50' : 'bg-emerald-50'"><p class="text-xs opacity-70">Patient balance</p><p class="text-lg font-extrabold">{{ money(current.patient_balance) }}</p></div>
          </div>

          <div v-if="current.patient_balance > 0 && current.status !== 'awaiting_approval' && current.status !== 'void' && auth.can('billing.collect')" class="rounded-2xl border border-slate-200 p-4">
            <h3 class="font-bold text-slate-900">Take payment</h3>
            <div class="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              <button v-for="p in meta.paymentMethods.filter((m) => !['insurance', 'credit'].includes(m.value))" :key="p.value" class="rounded-xl border px-2 py-2 text-xs font-bold" :class="pay.method === p.value ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600'" @click="pay.method = p.value">{{ p.label }}</button>
            </div>
            <div class="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <FormField label="Amount (ETB)"><input v-model.number="pay.amount" type="number" min="0.01" step="0.01" class="input text-lg font-bold" /></FormField>
              <FormField :label="needsReference ? 'Transaction ID' : 'Reference (optional)'"><input v-model="pay.reference" class="input font-mono" :placeholder="needsReference ? 'e.g. telebirr transaction number' : ''" /></FormField>
              <button class="btn btn-primary btn-lg" :disabled="paying || !pay.amount || (needsReference && !pay.reference)" @click="takePayment"><AppSpinner v-if="paying" /><CheckCircleIcon v-else class="size-5" /> Receive</button>
            </div>
          </div>

          <div v-if="current.payments?.length">
            <h3 class="mb-2 font-bold text-slate-900">Payments</h3>
            <ul class="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              <li v-for="p in current.payments" :key="p.id" class="flex justify-between px-4 py-2">
                <span>{{ meta.paymentLabel(p.method) }}<span v-if="p.reference" class="ml-1 font-mono text-xs text-slate-400">{{ p.reference }}</span><span class="block text-xs text-slate-500">{{ dateTime(p.paid_at) }} · {{ p.received_by }}</span></span>
                <b>{{ money(p.amount) }}</b>
              </li>
            </ul>
          </div>
        </div>
        <InvoiceReceipt :invoice="current" />
      </div>
      <template #footer>
        <button v-if="current && auth.can('billing.void') && current.status !== 'void' && current.document_type === 'invoice'" class="btn btn-ghost mr-auto text-rose-600" @click="voidInvoice"><ReceiptRefundIcon class="size-4" /> Void (credit note)</button>
        <button v-if="current && ['pending', 'failed'].includes(current.fiscal?.status)" class="btn btn-secondary" @click="registerFiscal()"><ArrowPathIcon class="size-4" /> Register with MoR</button>
        <button class="btn btn-primary" @click="printNow"><PrinterIcon class="size-4" /> Print receipt</button>
      </template>
    </AppModal>

    <!-- New invoice -->
    <AppModal :open="creating" title="New invoice" subtitle="Bill a customer for something that is not a medicine." size="lg" @close="creating = false">
      <div class="space-y-5">
        <div class="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
          <p><b>When to use this:</b> {{ hasPatients ? 'consultations, procedures, certificates and other services.' : 'services your pharmacy charges for, like a blood-pressure check or a delivery fee.' }}</p>
          <p class="mt-1">You do <b>not</b> need it for medicines: a sale at <b>Point of sale</b> creates its invoice and receipt automatically.</p>
          <div class="mt-3 flex flex-wrap items-center gap-1.5">
            <span class="text-xs font-semibold text-sky-800">Examples:</span>
            <button v-for="e in examples" :key="e" type="button" class="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100" @click="useExample(e)">+ {{ e }}</button>
          </div>
        </div>

        <section class="space-y-3">
          <p class="text-sm font-bold text-slate-900">1. Who pays?</p>
          <FormField v-if="hasPatients" label="Patient" hint="Or leave empty and type a walk-in customer's name below"><PatientPicker v-model="newPatient" /></FormField>
          <div v-if="!newPatient" class="grid gap-3 sm:grid-cols-3">
            <FormField label="Customer name" :error="newInvoice.errors.value.customer_name" required><input v-model="newInvoice.data.customer_name" class="input" placeholder="e.g. Abebe Kebede" /></FormField>
            <FormField label="Phone (optional)"><input v-model="newInvoice.data.customer_phone" class="input" placeholder="09XX XXX XXX" /></FormField>
            <FormField label="Buyer TIN (optional)" hint="Only when a company asks for a VAT invoice" :error="newInvoice.errors.value.customer_tin"><input v-model="newInvoice.data.customer_tin" class="input font-mono" maxlength="10" placeholder="10 digits" /></FormField>
          </div>
        </section>
        <FormField v-if="memberships.length" label="Bill to">
          <select v-model="newInvoice.data.membership_id" class="input"><option value="">Cash</option><option v-for="m in memberships" :key="m.id" :value="m.id">{{ m.payer?.name }} · {{ m.member_number }} (co-pay {{ m.effective_copay_percent }}%)</option></select>
        </FormField>
        <section class="space-y-3">
          <p class="text-sm font-bold text-slate-900">2. What are you charging for?</p>
          <div v-for="(l, i) in newInvoice.data.lines" :key="i" class="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1fr_5.5rem_8rem_6.5rem_auto] sm:items-end">
            <FormField :label="services.length ? 'Service' : 'Description'" :error="newInvoice.errors.value[`lines.${i}.description`]">
              <select v-if="services.length" v-model="l.service_id" class="input mb-2">
                <option value="">Something else (type it below)…</option>
                <option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }} - {{ money(s.price) }}</option>
              </select>
              <input v-if="!l.service_id" v-model="l.description" class="input" placeholder="e.g. Blood pressure check" />
            </FormField>
            <FormField label="Quantity" :error="newInvoice.errors.value[`lines.${i}.quantity`]"><input v-model.number="l.quantity" type="number" min="1" step="1" class="input" /></FormField>
            <FormField label="Price each (ETB)" :error="newInvoice.errors.value[`lines.${i}.unit_price`]">
              <input v-if="!l.service_id" v-model.number="l.unit_price" type="number" min="0" step="0.5" class="input" placeholder="0.00" />
              <p v-else class="input flex items-center bg-slate-50 text-slate-600">{{ money(linePrice(l), { symbol: '' }) }}</p>
            </FormField>
            <div class="text-right">
              <p class="field-label">Line total</p>
              <p class="py-2.5 font-bold tabular-nums">{{ money(linePrice(l) * Number(l.quantity || 0)) }}</p>
            </div>
            <button class="btn-icon mb-1 size-9" title="Remove this line" @click="newInvoice.data.lines.splice(i, 1)"><TrashIcon class="size-4" /></button>
            <label v-if="!l.service_id" class="flex items-center gap-2 text-xs text-slate-500 sm:col-span-5">
              <input type="checkbox" class="rounded" :checked="l.tax_category === 'standard'" @change="(e) => (l.tax_category = e.target.checked ? 'standard' : 'exempt')" />
              Taxable (VAT / TOT is added). Leave unticked for health services, which are tax-exempt.
            </label>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button class="btn btn-ghost btn-sm" @click="addLine"><PlusIcon class="size-4" /> Add another line</button>
            <RouterLink v-if="!services.length && auth.can('services.create')" :to="{ name: 'app.services' }" class="text-xs font-semibold text-brand-700 hover:underline">Charge the same services often? Save them in your price list →</RouterLink>
          </div>
          <p v-if="newInvoice.errors.value.lines" class="field-error">{{ newInvoice.errors.value.lines }}</p>
        </section>

        <div class="flex items-center justify-between border-t border-dashed border-slate-300 pt-3">
          <label class="flex items-center gap-2 text-sm text-slate-500">Discount (ETB) <input v-model.number="newInvoice.data.discount" type="number" min="0" class="input w-24 py-1" /></label>
          <span class="text-right"><span class="block text-xs text-slate-500">Total to pay</span><span class="text-2xl font-extrabold tabular-nums">{{ money(newTotal) }}</span></span>
        </div>
      </div>
      <template #footer>
        <span v-if="newTotal <= 0 || missingName" class="mr-auto self-center text-xs text-slate-500">{{ missingName ? 'Enter who is paying.' : 'Enter a price to continue.' }}</span>
        <button class="btn btn-secondary" @click="creating = false">Cancel</button>
        <button class="btn btn-primary" :disabled="newInvoice.processing.value || !newInvoice.data.lines.length || newTotal <= 0 || missingName" @click="createInvoice"><AppSpinner v-if="newInvoice.processing.value" /> Create invoice</button>
      </template>
    </AppModal>
  </div>
</template>
