<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ArrowPathIcon, BanknotesIcon, ClipboardDocumentCheckIcon, MinusIcon, PlusIcon, PrinterIcon, ShieldCheckIcon, ShieldExclamationIcon, SignalSlashIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { CheckCircleIcon } from '@heroicons/vue/24/solid'
import { useRoute } from 'vue-router'
import api from '@/lib/api'
import { money } from '@/lib/format'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useOfflineStore, uuid } from '@/stores/offline'
import SearchInput from '@/components/ui/SearchInput.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import DateText from '@/components/ui/DateText.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import ReceiptPrint from '@/components/orders/ReceiptPrint.vue'

const meta = useMetaStore()
const ui = useUiStore()
const auth = useAuthStore()
const offline = useOfflineStore()
const PRODUCTS_CACHE = 'medlink.pos.products'

const query = ref('')
const products = ref([])
const searching = ref(false)
const lines = ref([])
const rx = ref(null) // { prescription, stock }
const rxCode = ref('')
const rxLoading = ref(false)
const sale = reactive({ customer_name: '', customer_phone: '', payment_method: 'cash', discount: 0 })
const submitting = ref(false)
const receipt = ref(null)
const errors = ref({})
// Insurance / credit billing: the payer's share goes on the monthly claim, the patient pays the co-pay
const coverage = reactive({ open: false, payers: [], payer_id: '', member_number: '', membership: null, checking: false })

// Pay at the cashier: the pharmacist sends the sale, the cashier takes the money, then the medicine is handed over
const payAtCashier = computed(() => !!auth.tenant?.settings?.pay_at_cashier)
const sendsToCashier = computed(() => payAtCashier.value && offline.online)
const sentTicket = ref(null)
const atCashier = reactive({ waiting: [], paid: [], loading: false })
async function loadCashierBoard() {
  if (!payAtCashier.value) return
  atCashier.loading = true
  try {
    const [w, p] = await Promise.all([api.get('/pos/counter-sales'), api.get('/pos/counter-sales', { params: { status: 'paid' } })])
    atCashier.waiting = w.data.data
    atCashier.paid = p.data.data.slice(0, 8)
  } catch {
    /* the board is a convenience; selling still works */
  } finally {
    atCashier.loading = false
  }
}
async function cancelTicket(order) {
  const ok = await ui.confirm({ title: `Cancel ${order.order_number}?`, message: 'The customer has not paid. Nothing was taken from stock.', confirmText: 'Cancel sale', danger: true })
  if (!ok) return
  try {
    ui.success((await api.post(`/pos/counter-sales/${order.id}/cancel`)).data.message)
    loadCashierBoard()
  } catch (e) {
    ui.error(e.message)
  }
}
let boardTimer
onBeforeUnmount(() => clearInterval(boardTimer))

const route = useRoute()
onMounted(() => {
  meta.load()
  search()
  loadCashierBoard()
  boardTimer = setInterval(loadCashierBoard, 20000)
  // Opened from the e-Prescription inbox: load that prescription straight away
  if (route.query.rx) {
    rxCode.value = String(route.query.rx)
    loadPrescription()
  }
})

let timer
watch(query, () => {
  clearTimeout(timer)
  timer = setTimeout(search, 250)
})

async function search() {
  searching.value = true
  try {
    products.value = (await api.get('/pos/products', { params: { q: query.value } })).data.data
    if (!query.value) {
      try { localStorage.setItem(PRODUCTS_CACHE, JSON.stringify(products.value)) } catch { /* quota */ }
    }
  } catch (e) {
    if (e.status !== 0) throw e
    // Offline: search the last product list this device saw
    const cached = (() => { try { return JSON.parse(localStorage.getItem(PRODUCTS_CACHE) || '[]') } catch { return [] } })()
    const q = query.value.trim().toLowerCase()
    products.value = cached.filter((p) => !q || [p.medicine.display_name, p.medicine.brand_name, p.medicine.barcode].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  } finally {
    searching.value = false
  }
}

/** GS1 DataMatrix on medicine packs: ]d2 / (01).. / 01 + 14-digit GTIN. */
const looksLikeGs1 = (code) => /^(\]d2|\]C1|\(01\)|01\d{14})/.test(code.trim())

async function scanGs1(code) {
  try {
    const { data } = await api.get('/scan', { params: { code } })
    data.data.warnings.forEach((w) => ui.error(w, 'Scanned pack'))
    if (data.data.listing && !data.data.warnings.some((w) => w.includes('EXPIRED'))) add(data.data.listing)
    else if (!data.data.listing) ui.error('This product is not in your inventory.', 'Scanned pack')
  } catch (e) {
    ui.error(e.message)
  }
  query.value = ''
}

async function openCoverage() {
  coverage.open = !coverage.open
  if (coverage.open && !coverage.payers.length) coverage.payers = (await api.get('/payers', { params: { per_page: 100 } })).data.data
}

async function verifyMember() {
  coverage.checking = true
  try {
    const { data } = await api.post('/memberships/verify', { payer_id: coverage.payer_id, member_number: coverage.member_number })
    coverage.membership = data.data
    data.data.is_valid ? ui.success(data.message) : ui.error(data.message)
  } catch (e) {
    coverage.membership = null
    ui.error(e.message)
  } finally {
    coverage.checking = false
  }
}
const clearCoverage = () => Object.assign(coverage, { membership: null, member_number: '', open: false })

/** Barcode scanners type the code and press Enter: add the single match straight to the ticket. */
function onEnter() {
  if (looksLikeGs1(query.value)) return scanGs1(query.value)
  if (products.value.length === 1) {
    add(products.value[0])
    query.value = ''
  }
}

function add(listing, quantity = 1) {
  const existing = lines.value.find((l) => l.listing.id === listing.id)
  if (existing) existing.quantity = Math.min(existing.quantity + quantity, listing.available_quantity)
  else lines.value.unshift({ listing, quantity: Math.min(quantity, listing.available_quantity) })
}
const setQty = (line, q) => (line.quantity = Math.max(1, Math.min(Number(q) || 1, line.listing.available_quantity)))
const remove = (line) => (lines.value = lines.value.filter((l) => l !== line))

const subtotal = computed(() => lines.value.reduce((s, l) => s + l.quantity * l.listing.price, 0))
const total = computed(() => Math.max(0, subtotal.value - Number(sale.discount || 0)))
const needsRx = computed(() => lines.value.some((l) => (l.listing.medicine.prescription_required || l.listing.medicine.is_controlled) && !rx.value))

async function loadPrescription() {
  if (!rxCode.value) return
  rxLoading.value = true
  try {
    rx.value = (await api.get(`/pos/prescriptions/${encodeURIComponent(rxCode.value.trim())}`)).data.data
    if (!rx.value.prescription.is_dispensable) ui.error(`This prescription is ${rx.value.prescription.status} and cannot be dispensed.`)
    sale.customer_name ||= rx.value.prescription.patient?.full_name ?? ''
  } catch (e) {
    ui.error(e.message)
    rx.value = null
  } finally {
    rxLoading.value = false
  }
}

function addPrescribed() {
  for (const item of rx.value.prescription.items) {
    const listing = rx.value.stock[item.medicine_id]
    if (listing && item.remaining_quantity > 0 && listing.available_quantity > 0) {
      add({ ...listing, medicine: item.medicine }, item.remaining_quantity)
    }
  }
}

function clearRx() {
  rx.value = null
  rxCode.value = ''
}

async function complete() {
  submitting.value = true
  errors.value = {}
  const payload = {
    items: lines.value.map((l) => ({ pharmacy_medicine_id: l.listing.id, quantity: l.quantity })),
    prescription_code: rx.value?.prescription.reference_code ?? null,
    ...sale,
    customer_phone: sale.customer_phone || null,
    customer_name: sale.customer_name || null,
    membership_id: coverage.membership?.is_valid ? coverage.membership.id : null,
    client_uuid: uuid(), // makes retries and offline replays safe
  }
  try {
    const { data } = await api.post('/pos/sales', payload)
    ui.success(data.message)
    if (data.data.payment_status === 'unpaid') {
      sentTicket.value = data.data // waiting at the cashier - no receipt yet
      loadCashierBoard()
    } else {
      receipt.value = data.data
    }
    lines.value = []
    clearRx()
    Object.assign(sale, { customer_name: '', customer_phone: '', payment_method: 'cash', discount: 0 })
    clearCoverage()
    search()
  } catch (e) {
    if (e.status === 0 && !payload.prescription_code) {
      // No connection (or a power cut at the router): keep the sale on this device and sync later
      // Sold while offline: the money is taken here at the counter
      offline.enqueueSale({ ...payload, recorded_offline: true }, { total: total.value, items: lines.value.length })
      receipt.value = offlineReceipt(payload)
      ui.info('No connection - sale saved on this device and will sync automatically.', 'Saved offline')
      lines.value = []
      Object.assign(sale, { customer_name: '', customer_phone: '', payment_method: 'cash', discount: 0 })
      return
    }
    errors.value = e.errors
    ui.error(e.message, 'Sale not completed')
  } finally {
    submitting.value = false
  }
}

function offlineReceipt(payload) {
  const items = lines.value.map((l) => ({ id: l.listing.id, medicine: l.listing.medicine, quantity: l.quantity, unit_price: l.listing.price, line_total: l.quantity * l.listing.price }))
  return {
    order_number: 'OFFLINE-' + payload.client_uuid.slice(0, 8).toUpperCase(), offline: true, created_at: new Date().toISOString(),
    customer_name: payload.customer_name || 'Walk-in customer', items, subtotal: subtotal.value, discount: Number(sale.discount || 0),
    total_amount: total.value, payment_method: payload.payment_method,
  }
}

async function syncNow() {
  const { synced } = await offline.flush()
  if (synced) ui.success(synced + ' offline sale(s) synced')
  search()
}

const lineError = (line) => errors.value[`items.${line.listing.id}`] ?? null
const printReceipt = () => window.print()
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[1fr_26rem]">
    <!-- Products -->
    <section class="min-w-0 space-y-5">
      <div>
        <p class="text-xs font-bold tracking-[0.16em] text-brand-600 uppercase">Point of sale</p>
        <h1 class="text-2xl font-extrabold tracking-tight text-slate-900">Counter sale</h1>
      </div>

      <div v-if="!offline.online || offline.pending" class="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm" :class="offline.online ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-slate-900 text-white'">
        <SignalSlashIcon v-if="!offline.online" class="size-5 text-gold-400" />
        <span class="flex-1">
          <b>{{ offline.online ? 'Back online.' : 'You are offline.' }}</b>
          {{ offline.online ? '' : 'Keep selling - sales are saved on this device.' }}
          <template v-if="offline.pending"> {{ offline.pending }} sale(s) waiting to sync.</template>
          <span v-if="offline.lastError" class="block text-xs opacity-80">Last sync problem: {{ offline.lastError }}</span>
        </span>
        <button v-if="offline.online && offline.pending" class="btn btn-secondary btn-sm" :disabled="offline.syncing" @click="syncNow">
          <ArrowPathIcon class="size-4" :class="offline.syncing && 'animate-spin'" /> Sync now
        </button>
      </div>

      <!-- Pay at the cashier: what is waiting and what can be handed over -->
      <div v-if="payAtCashier" class="card overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span class="flex items-center gap-2 text-sm font-bold text-slate-700"><BanknotesIcon class="size-5 text-brand-600" /> At the cashier</span>
          <button class="btn-icon size-8" :disabled="atCashier.loading" @click="loadCashierBoard"><ArrowPathIcon class="size-4" :class="atCashier.loading && 'animate-spin'" /></button>
        </div>
        <div class="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p class="text-xs font-bold tracking-wide text-amber-700 uppercase">Waiting to pay ({{ atCashier.waiting.length }})</p>
            <ul class="mt-2 space-y-1.5 text-sm">
              <li v-for="o in atCashier.waiting" :key="o.id" class="flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2">
                <span class="min-w-0"><b class="font-mono">{{ o.order_number }}</b> <span class="block truncate text-xs text-slate-600">{{ o.customer_name }} · {{ money(o.total_amount) }}</span></span>
                <button class="text-xs font-semibold text-rose-600 hover:underline" @click="cancelTicket(o)">Cancel</button>
              </li>
              <li v-if="!atCashier.waiting.length" class="text-xs text-slate-400">Nobody is waiting.</li>
            </ul>
          </div>
          <div>
            <p class="text-xs font-bold tracking-wide text-emerald-700 uppercase">Paid - hand over</p>
            <ul class="mt-2 space-y-1.5 text-sm">
              <li v-for="o in atCashier.paid" :key="o.id" class="rounded-xl bg-emerald-50 px-3 py-2">
                <b class="font-mono">{{ o.order_number }}</b> <span class="text-emerald-700">✓ paid</span>
                <span class="block truncate text-xs text-slate-600">{{ o.customer_name }} · {{ (o.items ?? []).map((i) => `${i.medicine?.display_name ?? ''} ×${i.fulfilled_quantity || i.quantity}`).join(', ') }}</span>
              </li>
              <li v-if="!atCashier.paid.length" class="text-xs text-slate-400">No paid sales yet today.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Prescription loader -->
      <div class="card overflow-hidden">
        <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <span class="flex items-center gap-2 text-sm font-bold text-slate-700"><ClipboardDocumentCheckIcon class="size-5 text-rose-500" /> Dispense a prescription</span>
          <form class="flex flex-1 gap-2" @submit.prevent="loadPrescription">
            <input v-model="rxCode" class="input flex-1 font-mono uppercase" placeholder="Scan QR or type RX-XXXX-XXXX" />
            <button class="btn btn-secondary" :disabled="rxLoading"><AppSpinner v-if="rxLoading" /> Load</button>
          </form>
        </div>
        <div v-if="rx" class="border-t border-rose-100 bg-rose-50/40 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-mono font-bold text-slate-900">{{ rx.prescription.reference_code }}
                <span class="chip ml-1" :class="rx.prescription.is_dispensable ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' : 'bg-rose-100 text-rose-700 ring-rose-600/20'">{{ rx.prescription.status.replace('_', ' ') }}</span>
              </p>
              <p class="text-sm text-slate-600">{{ rx.prescription.patient?.full_name }} · {{ rx.prescription.doctor?.name }} ({{ rx.prescription.hospital?.name }})</p>
              <p class="text-xs text-slate-500">Valid until <DateText :value="rx.prescription.expires_at" /></p>
              <p v-if="rx.prescription.patient?.allergies" class="mt-1 text-xs font-bold text-rose-700">⚠ Allergies: {{ rx.prescription.patient.allergies }}</p>
            </div>
            <button class="btn-icon" @click="clearRx"><XMarkIcon class="size-5" /></button>
          </div>
          <ul class="mt-3 space-y-1.5 text-sm">
            <li v-for="item in rx.prescription.items" :key="item.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-rose-100">
              <span><b>{{ item.medicine.display_name }}</b> <span class="text-xs text-slate-500">{{ item.dosage }}, {{ item.frequency }}, {{ item.duration_days }}d</span></span>
              <span class="text-xs">
                <b class="text-brand-700">{{ item.remaining_quantity }}</b> of {{ item.total_quantity }} left ·
                <span :class="rx.stock[item.medicine_id]?.available_quantity ? 'text-emerald-700' : 'font-semibold text-rose-600'">{{ rx.stock[item.medicine_id] ? `${rx.stock[item.medicine_id].available_quantity} in stock` : 'not stocked here' }}</span>
              </span>
            </li>
          </ul>
          <button v-if="rx.prescription.is_dispensable" class="btn btn-primary btn-sm mt-3" @click="addPrescribed"><PlusIcon class="size-4" /> Add remaining items to sale</button>
        </div>
      </div>

      <SearchInput v-model="query" placeholder="Search name or scan barcode, then press Enter" class="[&_input]:h-12 [&_input]:text-base" @keydown.enter.prevent="onEnter" />

      <div class="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <template v-if="searching && !products.length"><div v-for="i in 6" :key="i" class="skeleton h-28 rounded-2xl" /></template>
        <button v-for="p in products" :key="p.id" class="card card-hover flex items-start gap-3 p-4 text-left" @click="add(p)">
          <MedicineAvatar :form="p.medicine.dosage_form" />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold text-slate-900">{{ p.medicine.display_name }}</span>
            <span class="block truncate text-xs text-slate-500">{{ p.medicine.dosage_form }}<template v-if="p.medicine.brand_name"> · {{ p.medicine.brand_name }}</template></span>
            <span class="mt-2 flex items-center justify-between">
              <b class="text-slate-900">{{ money(p.price) }}</b>
              <span class="text-xs" :class="p.stock_status === 'low_stock' ? 'font-semibold text-amber-600' : 'text-slate-500'">{{ p.available_quantity }} in stock</span>
            </span>
            <span v-if="p.medicine.prescription_required" class="mt-1 inline-flex items-center gap-1 text-[0.7rem] font-bold text-rose-600"><ShieldExclamationIcon class="size-3.5" /> Prescription only</span>
          </span>
        </button>
        <p v-if="!searching && !products.length" class="col-span-full py-10 text-center text-sm text-slate-500">No sellable stock matches “{{ query }}”.</p>
      </div>
    </section>

    <!-- Ticket -->
    <aside class="card flex h-fit flex-col overflow-hidden xl:sticky xl:top-24">
      <div class="flag-ribbon h-1" />
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 class="font-bold text-slate-900">Current sale</h2>
        <button v-if="lines.length" class="text-xs font-semibold text-rose-600 hover:underline" @click="lines = []">Clear</button>
      </div>
      <ul class="max-h-[40vh] divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
        <li v-for="line in lines" :key="line.listing.id" class="px-5 py-3">
          <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-slate-900">{{ line.listing.medicine.display_name }}</p>
              <p class="text-xs text-slate-500">{{ money(line.listing.price) }} · max {{ line.listing.available_quantity }}</p>
            </div>
            <div class="flex items-center rounded-lg border border-slate-200">
              <button class="grid size-7 place-items-center text-slate-500" @click="setQty(line, line.quantity - 1)"><MinusIcon class="size-3.5" /></button>
              <input :value="line.quantity" type="number" class="w-11 border-0 p-0 text-center text-sm font-bold focus:ring-0 focus:outline-none" @change="setQty(line, $event.target.value)" />
              <button class="grid size-7 place-items-center text-slate-500" @click="setQty(line, line.quantity + 1)"><PlusIcon class="size-3.5" /></button>
            </div>
            <p class="w-20 text-right text-sm font-bold">{{ money(line.quantity * line.listing.price, { symbol: '' }) }}</p>
            <button class="text-slate-400 hover:text-rose-600" @click="remove(line)"><TrashIcon class="size-4" /></button>
          </div>
          <p v-if="lineError(line)" class="mt-1.5 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">{{ lineError(line) }}</p>
        </li>
        <li v-if="!lines.length" class="px-5 py-12 text-center text-sm text-slate-400">Tap a product to start a sale</li>
      </ul>

      <div class="space-y-4 border-t border-slate-100 bg-slate-50/60 p-5">
        <p v-if="needsRx" class="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">⚠ Prescription-only items: load the patient's prescription first.</p>
        <div class="grid grid-cols-2 gap-2">
          <input v-model="sale.customer_name" class="input" placeholder="Customer name (optional)" />
          <input v-model="sale.customer_phone" class="input" placeholder="Phone (optional)" />
        </div>
        <div v-if="auth.hasModule('insurance') && auth.can('insurance.view')" class="rounded-xl border border-slate-200 bg-white">
          <button class="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-slate-600" @click="openCoverage">
            <span class="flex items-center gap-1.5"><ShieldCheckIcon class="size-4 text-brand-600" /> {{ coverage.membership ? coverage.membership.payer?.name : 'Insurance / credit customer' }}</span>
            <span v-if="coverage.membership" class="chip" :class="coverage.membership.is_valid ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' : 'bg-rose-50 text-rose-700 ring-rose-600/15'">{{ coverage.membership.is_valid ? 'co-pay ' + coverage.membership.effective_copay_percent + '%' : 'not valid' }}</span>
          </button>
          <div v-if="coverage.open" class="space-y-2 border-t border-slate-100 p-3">
            <select v-model="coverage.payer_id" class="input py-1.5 text-sm"><option value="">Choose payer…</option><option v-for="p in coverage.payers" :key="p.id" :value="p.id">{{ p.name }}</option></select>
            <div class="flex gap-2">
              <input v-model="coverage.member_number" class="input flex-1 py-1.5 font-mono text-sm" placeholder="Member / ID number" />
              <button class="btn btn-secondary btn-sm" :disabled="!coverage.payer_id || !coverage.member_number || coverage.checking" @click="verifyMember"><AppSpinner v-if="coverage.checking" /> Verify</button>
            </div>
            <p v-if="coverage.membership" class="text-xs text-slate-500">{{ coverage.membership.beneficiary_name }} · valid to {{ coverage.membership.valid_to || 'open' }} <button class="ml-1 font-semibold text-rose-600" @click="clearCoverage">remove</button></p>
          </div>
        </div>
        <p v-if="sendsToCashier" class="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">The customer pays at the <b>cashier</b>. Hand the medicine over once the sale shows as paid.</p>
        <div v-else class="grid grid-cols-3 gap-1.5">
          <button v-for="p in meta.paymentMethods" :key="p.value" class="rounded-xl border px-2 py-2 text-xs font-bold transition" :class="sale.payment_method === p.value ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'" @click="sale.payment_method = p.value">
            {{ p.label.replace('Health insurance (CBHI / EHIS)', 'Insurance') }}
          </button>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500">Discount (ETB)</span>
          <input v-model="sale.discount" type="number" min="0" class="input w-28 py-1.5 text-right" />
        </div>
        <div class="flex items-end justify-between border-t border-dashed border-slate-300 pt-3">
          <span class="text-sm text-slate-500">Total · {{ lines.length }} item(s)</span>
          <span class="text-3xl font-extrabold tracking-tight text-slate-900">{{ money(total) }}</span>
        </div>
        <button class="btn btn-primary btn-lg w-full" :disabled="!lines.length || submitting" @click="complete">
          <AppSpinner v-if="submitting" /><CheckCircleIcon v-else class="size-5" /> {{ sendsToCashier ? 'Send to cashier' : 'Complete sale' }}
        </button>
      </div>
    </aside>

    <AppModal :open="!!sentTicket" title="Sent to the cashier" size="sm" @close="sentTicket = null">
      <div v-if="sentTicket" class="space-y-3 text-center">
        <p class="text-sm text-slate-600">Ask the customer to pay at the cashier and give this number:</p>
        <p class="font-mono text-3xl font-extrabold tracking-wider text-slate-900">{{ sentTicket.order_number }}</p>
        <p class="text-2xl font-extrabold text-brand-700">{{ money(sentTicket.total_amount) }}</p>
        <p class="text-xs text-slate-500">{{ sentTicket.customer_name }} · nothing leaves the shelf until it is paid</p>
      </div>
      <template #footer>
        <button class="btn btn-primary" @click="sentTicket = null">Next customer</button>
      </template>
    </AppModal>

    <AppModal :open="!!receipt" :title="receipt?.offline ? 'Saved offline' : 'Sale complete'" size="sm" @close="receipt = null">
      <ReceiptPrint v-if="receipt" :order="receipt" />
      <template #footer>
        <button class="btn btn-secondary" @click="receipt = null">New sale</button>
        <button class="btn btn-primary" @click="printReceipt"><PrinterIcon class="size-4" /> Print receipt</button>
      </template>
    </AppModal>
  </div>
</template>
