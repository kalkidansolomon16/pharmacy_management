<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CheckCircleIcon, PhoneIcon, PrinterIcon, TruckIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, phone, titleCase } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import OrderProgress from '@/components/orders/OrderProgress.vue'
import ReceiptPrint from '@/components/orders/ReceiptPrint.vue'

const route = useRoute()
const auth = useAuthStore()
const meta = useMetaStore()
const ui = useUiStore()
meta.load()

const order = ref(null)
const busy = ref(null)
const showReceipt = ref(false)
const partialPrompt = ref(null)

async function load() {
  order.value = (await api.get(`/orders/${route.params.id}`)).data.data
}
onMounted(load)

const can = (status) => auth.can('orders.manage') && order.value?.allowed_transitions.includes(status)
const isFinal = computed(() => order.value && ['completed', 'partially_completed', 'cancelled', 'rejected'].includes(order.value.status))

async function act(action, body = {}) {
  busy.value = action
  try {
    const { data } = await api.post(`/orders/${order.value.id}/${action}`, body)
    ui.success(data.message)
    await load()
    if (action === 'complete') showReceipt.value = true
    return true
  } catch (e) {
    if (action === 'complete' && e.status === 422 && !body.allow_partial) partialPrompt.value = e.message
    else ui.error(e.message)
    return false
  } finally {
    busy.value = null
  }
}

async function reject() {
  const reason = await ui.confirm({ title: 'Reject this order?', message: 'Tell the customer why - they will be notified.', confirmText: 'Reject order', danger: true, input: { label: 'Reason', required: true, placeholder: 'e.g. Out of stock, please try Bole branch' } })
  if (reason) act('reject', { reason })
}
async function cancel() {
  const reason = await ui.confirm({ title: 'Cancel this order?', message: 'Use this when the customer no longer wants it.', confirmText: 'Cancel order', danger: true, input: { label: 'Reason (optional)' } })
  if (reason) act('cancel', { reason: reason === true ? null : reason })
}
const printReceipt = () => window.print()

async function completePartially() {
  partialPrompt.value = null
  await act('complete', { allow_partial: true })
}
</script>

<template>
  <div>
    <RouterLink :to="{ name: 'app.orders' }" class="no-print text-sm font-semibold text-slate-500 hover:text-slate-800">← Orders</RouterLink>
    <div v-if="!order" class="skeleton mt-4 h-96 rounded-3xl" />
    <template v-else>
      <div class="no-print mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="font-mono text-2xl font-extrabold tracking-wider text-slate-900">{{ order.order_number }}</h1>
            <StatusBadge :status="order.status" />
            <StatusBadge :status="order.channel" :dot="false" />
          </div>
          <p class="mt-1 text-sm text-slate-500">Received <DateText :value="order.created_at" time /><template v-if="order.created_by"> · by {{ order.created_by }}</template></p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-if="isFinal && order.fulfilled_at" class="btn btn-secondary" @click="showReceipt = true"><PrinterIcon class="size-4" /> Receipt</button>
          <button v-if="can('cancelled')" class="btn btn-ghost" @click="cancel">Cancel</button>
          <button v-if="can('rejected')" class="btn btn-soft-danger" :disabled="!!busy" @click="reject"><XCircleIcon class="size-4" /> Reject</button>
          <button v-if="can('confirmed')" class="btn btn-secondary" :disabled="!!busy" @click="act('confirm')"><AppSpinner v-if="busy === 'confirm'" /><CheckCircleIcon v-else class="size-4" /> Confirm</button>
          <button v-if="can('ready')" class="btn btn-secondary" :disabled="!!busy" @click="act('ready')"><AppSpinner v-if="busy === 'ready'" /><TruckIcon v-else class="size-4" /> {{ order.fulfillment === 'delivery' ? 'Out for delivery' : 'Ready for pickup' }}</button>
          <button v-if="can('completed')" class="btn btn-primary" :disabled="!!busy" @click="act('complete')"><AppSpinner v-if="busy === 'complete'" /> Dispense & complete</button>
        </div>
      </div>

      <div class="no-print card card-pad mt-6"><OrderProgress :status="order.status" :fulfillment="order.fulfillment" /></div>

      <div class="no-print mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section class="card overflow-hidden">
          <div class="px-5 pt-5 pb-3"><h2 class="font-bold text-slate-900">Items</h2></div>
          <table class="table">
            <thead><tr><th>Medicine</th><th class="text-center">Ordered</th><th class="text-center">Dispensed</th><th class="text-right">Price</th><th class="text-right">Total</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in order.items" :key="item.id">
                <td>
                  <div class="flex items-center gap-3">
                    <MedicineAvatar :form="item.medicine?.dosage_form" size="sm" />
                    <div>
                      <p class="font-semibold text-slate-900">{{ item.medicine?.display_name }}</p>
                      <p v-if="item.prescription_item_id" class="text-xs font-semibold text-rose-600">On prescription</p>
                      <p v-for="b in item.batches" :key="b.batch_number" class="font-mono text-[0.7rem] text-slate-400">batch {{ b.batch_number }} × {{ b.quantity }} (exp {{ b.expiry_date }})</p>
                    </div>
                  </div>
                </td>
                <td class="text-center">{{ item.quantity }}</td>
                <td class="text-center">
                  <span v-if="!order.fulfilled_at" class="text-slate-400">—</span>
                  <b v-else :class="item.fulfilled_quantity < item.quantity ? 'text-orange-600' : 'text-emerald-600'">{{ item.fulfilled_quantity }}</b>
                </td>
                <td class="text-right">{{ money(item.unit_price) }}</td>
                <td class="text-right font-semibold">{{ money(item.line_total) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="space-y-1 border-t border-slate-100 bg-slate-50/60 p-5 text-sm">
            <div class="flex justify-between text-slate-500"><span>Subtotal</span><span>{{ money(order.subtotal) }}</span></div>
            <div v-if="order.discount" class="flex justify-between text-slate-500"><span>Discount</span><span>− {{ money(order.discount) }}</span></div>
            <div class="flex justify-between text-lg font-extrabold text-slate-900"><span>Total</span><span>{{ money(order.total_amount) }}</span></div>
          </div>
        </section>

        <aside class="space-y-4">
          <div class="card card-pad">
            <p class="text-xs font-bold tracking-wide text-slate-400 uppercase">Customer</p>
            <p class="mt-1 font-bold text-slate-900">{{ order.customer_name }}</p>
            <a v-if="order.customer_phone" :href="`tel:${order.customer_phone}`" class="mt-1 flex items-center gap-1.5 text-sm font-semibold text-brand-700"><PhoneIcon class="size-4" /> {{ phone(order.customer_phone) }}</a>
            <p v-if="order.notes" class="mt-3 rounded-xl bg-gold-50 p-3 text-sm text-amber-900">“{{ order.notes }}”</p>
          </div>
          <div class="card card-pad space-y-2.5 text-sm">
            <div class="flex justify-between"><span class="text-slate-500">Fulfilment</span><b>{{ titleCase(order.fulfillment) }}</b></div>
            <p v-if="order.delivery_address" class="rounded-xl bg-slate-50 p-3 text-slate-600">{{ order.delivery_address }}</p>
            <div class="flex justify-between"><span class="text-slate-500">Payment</span><b>{{ meta.paymentLabel(order.payment_method) }}</b></div>
            <div class="flex justify-between"><span class="text-slate-500">Payment status</span><StatusBadge :status="order.payment_status" /></div>
            <div v-if="order.prescription" class="flex justify-between"><span class="text-slate-500">Prescription</span><b class="font-mono text-rose-600">{{ order.prescription.reference_code }}</b></div>
            <div v-if="order.fulfilled_at" class="flex justify-between"><span class="text-slate-500">Dispensed</span><DateText :value="order.fulfilled_at" time /></div>
            <p v-if="order.cancel_reason" class="rounded-xl bg-rose-50 p-3 text-rose-700">Reason: {{ order.cancel_reason }}</p>
          </div>
          <div v-if="!isFinal" class="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-xs text-brand-800">
            Completing deducts stock batch-by-batch, earliest expiry first, and updates the patient's prescription balance.
          </div>
        </aside>
      </div>
    </template>

    <AppModal :open="!!partialPrompt" title="Not enough stock for the full order" size="sm" @close="partialPrompt = null">
      <p class="text-sm text-slate-600">{{ partialPrompt }}</p>
      <p class="mt-3 text-sm text-slate-600">You can dispense what is available now. The customer is charged only for dispensed units and can collect the remainder elsewhere with the same prescription.</p>
      <template #footer>
        <button class="btn btn-secondary" @click="partialPrompt = null">Go back</button>
        <button class="btn btn-primary" @click="completePartially">Dispense available stock</button>
      </template>
    </AppModal>

    <AppModal :open="showReceipt" title="Receipt" size="sm" @close="showReceipt = false">
      <ReceiptPrint v-if="order" :order="order" />
      <template #footer>
        <button class="btn btn-secondary" @click="showReceipt = false">Close</button>
        <button class="btn btn-primary" @click="printReceipt"><PrinterIcon class="size-4" /> Print</button>
      </template>
    </AppModal>
  </div>
</template>
