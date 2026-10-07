<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ClipboardDocumentCheckIcon, MinusIcon, PlusIcon, PrinterIcon, ShieldExclamationIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { CheckCircleIcon } from '@heroicons/vue/24/solid'
import api from '@/lib/api'
import { money } from '@/lib/format'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import SearchInput from '@/components/ui/SearchInput.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import DateText from '@/components/ui/DateText.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import ReceiptPrint from '@/components/orders/ReceiptPrint.vue'

const meta = useMetaStore()
const ui = useUiStore()

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

onMounted(() => {
  meta.load()
  search()
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
  } finally {
    searching.value = false
  }
}

/** Barcode scanners type the code and press Enter: add the single match straight to the ticket. */
function onEnter() {
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
  try {
    const { data } = await api.post('/pos/sales', {
      items: lines.value.map((l) => ({ pharmacy_medicine_id: l.listing.id, quantity: l.quantity })),
      prescription_code: rx.value?.prescription.reference_code ?? null,
      ...sale,
      customer_phone: sale.customer_phone || null,
      customer_name: sale.customer_name || null,
    })
    ui.success(data.message)
    receipt.value = data.data
    lines.value = []
    clearRx()
    Object.assign(sale, { customer_name: '', customer_phone: '', payment_method: 'cash', discount: 0 })
    search()
  } catch (e) {
    errors.value = e.errors
    ui.error(e.message, 'Sale not completed')
  } finally {
    submitting.value = false
  }
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
        <div class="grid grid-cols-3 gap-1.5">
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
          <AppSpinner v-if="submitting" /><CheckCircleIcon v-else class="size-5" /> Complete sale
        </button>
      </div>
    </aside>

    <AppModal :open="!!receipt" title="Sale complete" size="sm" @close="receipt = null">
      <ReceiptPrint v-if="receipt" :order="receipt" />
      <template #footer>
        <button class="btn btn-secondary" @click="receipt = null">New sale</button>
        <button class="btn btn-primary" @click="printReceipt"><PrinterIcon class="size-4" /> Print receipt</button>
      </template>
    </AppModal>
  </div>
</template>
