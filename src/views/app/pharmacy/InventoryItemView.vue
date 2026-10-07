<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { AdjustmentsVerticalIcon, PencilSquareIcon, TruckIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, number } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useForm } from '@/composables/useForm'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import ReceiveStockModal from '@/components/inventory/ReceiveStockModal.vue'
import ListingFormModal from '@/components/inventory/ListingFormModal.vue'

const route = useRoute()
const auth = useAuthStore()
const canManage = auth.can('inventory.manage')

const listing = ref(null)
const movements = ref([])
const receiving = ref(false)
const editing = ref(false)
const adjusting = ref(null)

async function load() {
  const [l, m] = await Promise.all([
    api.get(`/inventory/${route.params.id}`),
    api.get('/stock-movements', { params: { listing_id: route.params.id, per_page: 15 } }),
  ])
  listing.value = l.data.data
  movements.value = m.data.data
}
onMounted(load)

// FEFO order: the batch that will be sold next comes first
const batches = computed(() => [...(listing.value?.batches ?? [])].sort((a, b) => {
  const aSellable = a.quantity > 0 && a.days_to_expiry > 0
  const bSellable = b.quantity > 0 && b.days_to_expiry > 0
  if (aSellable !== bSellable) return aSellable ? -1 : 1
  return a.expiry_date.localeCompare(b.expiry_date)
}))
const nextBatchId = computed(() => batches.value.find((b) => b.quantity > 0 && b.days_to_expiry > 0)?.id)
const stockValue = computed(() => batches.value.filter((b) => b.days_to_expiry > 0).reduce((s, b) => s + b.quantity * b.purchase_price, 0))

const reasons = ['Damaged / broken', 'Physical count correction', 'Returned to supplier', 'Lost or stolen', 'Customer return (resaleable)', 'Other']
const adjust = useForm({ direction: '-', quantity: '', reason: reasons[0], note: '' })
function openAdjust(batch) {
  adjust.reset({ direction: '-', quantity: '', reason: reasons[0], note: '' })
  adjusting.value = batch
}
async function submitAdjust() {
  const qty = Number(adjust.data.quantity) * (adjust.data.direction === '-' ? -1 : 1)
  const reason = adjust.data.note ? `${adjust.data.reason}: ${adjust.data.note}` : adjust.data.reason
  await adjust.submit(() => api.post(`/batches/${adjusting.value.id}/adjust`, { quantity: qty, reason }), {
    onSuccess: () => { adjusting.value = null; load() },
  }).catch(() => {})
}

function saved() {
  receiving.value = false
  editing.value = false
  load()
}
</script>

<template>
  <div>
    <RouterLink :to="{ name: 'app.inventory' }" class="text-sm font-semibold text-slate-500 hover:text-slate-800">← Inventory</RouterLink>
    <div v-if="!listing" class="skeleton mt-4 h-96 rounded-3xl" />
    <template v-else>
      <div class="mt-4 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-4">
          <MedicineAvatar :form="listing.medicine.dosage_form" size="lg" />
          <div>
            <h1 class="text-2xl font-extrabold tracking-tight text-slate-900">{{ listing.medicine.display_name }}</h1>
            <p class="text-sm text-slate-500">{{ listing.medicine.dosage_form }} · {{ listing.medicine.manufacturer }} · {{ listing.medicine.category?.name }}</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge :status="listing.stock_status" />
              <span v-if="listing.medicine.prescription_required" class="chip bg-rose-50 text-rose-700 ring-rose-600/15">Prescription only</span>
              <span v-if="listing.medicine.is_controlled" class="chip bg-violet-50 text-violet-700 ring-violet-600/15">Controlled</span>
              <span class="chip" :class="listing.is_public ? 'bg-sky-50 text-sky-700 ring-sky-600/15' : 'bg-slate-100 text-slate-500 ring-slate-300'">{{ listing.is_public ? 'Visible online' : 'Hidden online' }}</span>
            </div>
          </div>
        </div>
        <div v-if="canManage" class="flex gap-2">
          <button class="btn btn-secondary" @click="editing = true"><PencilSquareIcon class="size-4" /> Edit price</button>
          <button class="btn btn-primary" @click="receiving = true"><TruckIcon class="size-4" /> Receive stock</button>
        </div>
      </div>

      <div class="mt-6 grid gap-4 sm:grid-cols-4">
        <div class="card card-pad"><p class="text-sm text-slate-500">Sellable stock</p><p class="mt-1 text-2xl font-extrabold">{{ number(listing.available_quantity) }} <span class="text-sm font-medium text-slate-400">{{ listing.medicine.unit }}s</span></p></div>
        <div class="card card-pad"><p class="text-sm text-slate-500">Selling price</p><p class="mt-1 text-2xl font-extrabold">{{ money(listing.price) }}</p></div>
        <div class="card card-pad"><p class="text-sm text-slate-500">Reorder level</p><p class="mt-1 text-2xl font-extrabold">{{ listing.reorder_level }}</p></div>
        <div class="card card-pad"><p class="text-sm text-slate-500">Stock value at cost</p><p class="mt-1 text-2xl font-extrabold">{{ money(stockValue) }}</p></div>
      </div>

      <section class="card mt-6 overflow-hidden">
        <div class="px-5 pt-5 pb-3">
          <h2 class="font-bold text-slate-900">Batches</h2>
          <p class="text-sm text-slate-500">Listed in First-Expiry-First-Out order. The highlighted batch is dispensed next.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead><tr><th>Batch</th><th>Expiry</th><th>Remaining</th><th>Cost / unit</th><th>Supplier</th><th>Received</th><th /></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="b in batches" :key="b.id" :class="b.id === nextBatchId && '!bg-brand-50/60'">
                <td>
                  <span class="font-mono text-sm font-bold">{{ b.batch_number }}</span>
                  <span v-if="b.id === nextBatchId" class="chip ml-2 bg-brand-600 text-white ring-0">Next out</span>
                </td>
                <td>
                  <DateText :value="b.expiry_date" />
                  <div class="mt-0.5"><StatusBadge :status="b.expiry_status" :label="b.days_to_expiry <= 0 ? 'Expired' : `${b.days_to_expiry} days`" /></div>
                </td>
                <td><b>{{ number(b.quantity) }}</b> <span class="text-xs text-slate-400">/ {{ number(b.initial_quantity) }}</span></td>
                <td>{{ money(b.purchase_price) }}</td>
                <td class="max-w-48 truncate text-xs text-slate-500">{{ b.supplier }}</td>
                <td><DateText :value="b.received_at" /></td>
                <td class="text-right">
                  <button v-if="canManage && b.quantity > 0" class="btn btn-ghost btn-sm" @click="openAdjust(b)"><AdjustmentsVerticalIcon class="size-4" /> Adjust</button>
                </td>
              </tr>
              <tr v-if="!batches.length"><td colspan="7" class="py-10 text-center text-slate-500">No batches yet - receive stock to start selling.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card mt-6 overflow-hidden">
        <div class="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 class="font-bold text-slate-900">Recent stock movements</h2>
          <RouterLink :to="{ name: 'app.movements', query: { listing_id: listing.id } }" class="text-xs font-semibold text-brand-700 hover:underline">Full history</RouterLink>
        </div>
        <ul class="divide-y divide-slate-100">
          <li v-for="m in movements" :key="m.id" class="flex items-center gap-4 px-5 py-3 text-sm">
            <StatusBadge :status="m.type" class="w-28 justify-center" />
            <span class="w-16 text-right font-bold" :class="m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'">{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}</span>
            <span class="min-w-0 flex-1 truncate text-slate-600">{{ m.reason }} <span class="text-xs text-slate-400">· batch {{ m.batch?.batch_number }}</span></span>
            <span class="hidden text-xs text-slate-400 sm:block">{{ m.created_by || 'System' }}</span>
            <span class="w-28 text-right text-xs text-slate-400"><DateText :value="m.created_at" relative /></span>
          </li>
        </ul>
      </section>
    </template>

    <ReceiveStockModal :open="receiving" :listing="listing" @close="receiving = false" @saved="saved" />
    <ListingFormModal :open="editing" :listing="listing" @close="editing = false" @saved="saved" />

    <AppModal :open="!!adjusting" title="Adjust stock" :subtitle="adjusting ? `Batch ${adjusting.batch_number} · ${adjusting.quantity} units on hand` : ''" size="sm" @close="adjusting = null">
      <form id="adjust-form" class="space-y-4" @submit.prevent="submitAdjust">
        <div class="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          <button type="button" class="rounded-lg py-2" :class="adjust.data.direction === '-' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'" @click="adjust.data.direction = '-'">− Remove</button>
          <button type="button" class="rounded-lg py-2" :class="adjust.data.direction === '+' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'" @click="adjust.data.direction = '+'">+ Add</button>
        </div>
        <FormField label="Quantity" :error="adjust.errors.value.quantity" required><input v-model="adjust.data.quantity" type="number" min="1" class="input" required /></FormField>
        <FormField label="Reason" :error="adjust.errors.value.reason">
          <select v-model="adjust.data.reason" class="input"><option v-for="r in reasons" :key="r">{{ r }}</option></select>
        </FormField>
        <FormField label="Note (optional)"><input v-model="adjust.data.note" class="input" placeholder="e.g. 2 strips crushed in delivery" /></FormField>
        <p class="text-xs text-slate-500">Every adjustment is recorded in the stock history and audit log.</p>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="adjusting = null">Cancel</button>
        <button form="adjust-form" class="btn btn-primary" :disabled="adjust.processing.value"><AppSpinner v-if="adjust.processing.value" /> Record adjustment</button>
      </template>
    </AppModal>
  </div>
</template>
