<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { BuildingStorefrontIcon, MapPinIcon, PhoneIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, phone, titleCase } from '@/lib/format'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import OrderProgress from '@/components/orders/OrderProgress.vue'

const route = useRoute()
const meta = useMetaStore()
const ui = useUiStore()
const order = ref(null)

async function load() {
  order.value = (await api.get(`/my/orders/${route.params.id}`)).data.data
}
onMounted(() => {
  meta.load()
  load()
})

async function cancel() {
  const reason = await ui.confirm({ title: 'Cancel this order?', message: 'The pharmacy will be notified.', confirmText: 'Cancel order', danger: true, input: { label: 'Reason (optional)' } })
  if (!reason) return
  try {
    const { data } = await api.post(`/my/orders/${order.value.id}/cancel`, { reason: reason === true ? null : reason })
    ui.success(data.message)
    await load()
  } catch (e) {
    ui.error(e.message)
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <RouterLink :to="{ name: 'account.orders' }" class="text-sm font-semibold text-slate-500 hover:text-slate-800">← My orders</RouterLink>
    <div v-if="!order" class="skeleton mt-6 h-96 rounded-3xl" />
    <template v-else>
      <div class="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 class="font-mono text-2xl font-extrabold tracking-wider text-slate-900">{{ order.order_number }}</h1>
          <p class="text-sm text-slate-500">Placed <DateText :value="order.created_at" time /></p>
        </div>
        <div class="flex items-center gap-2">
          <StatusBadge :status="order.status" />
          <button v-if="order.status === 'pending'" class="btn btn-soft-danger btn-sm" @click="cancel">Cancel order</button>
        </div>
      </div>

      <div class="card card-pad mt-6"><OrderProgress :status="order.status" :fulfillment="order.fulfillment" /></div>
      <p v-if="order.cancel_reason" class="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">Reason: {{ order.cancel_reason }}</p>
      <p v-if="order.status === 'partially_completed'" class="mt-3 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-800">
        Some items were not fully available, so you were charged only for what was dispensed. You can collect the rest elsewhere with the same prescription.
      </p>

      <div class="mt-6 grid gap-6 md:grid-cols-[1fr_18rem]">
        <div class="card overflow-hidden">
          <ul class="divide-y divide-slate-100">
            <li v-for="item in order.items" :key="item.id" class="flex items-center gap-4 p-4">
              <MedicineAvatar :form="item.medicine?.dosage_form" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-slate-900">{{ item.medicine?.display_name }}</p>
                <p class="text-xs text-slate-500">
                  {{ item.quantity }} × {{ money(item.unit_price) }}
                  <span v-if="order.fulfilled_at && item.fulfilled_quantity < item.quantity" class="font-semibold text-orange-600">· {{ item.fulfilled_quantity }} dispensed</span>
                </p>
              </div>
              <p class="font-bold text-slate-900">{{ money(item.line_total) }}</p>
            </li>
          </ul>
          <div class="space-y-1 border-t border-slate-100 bg-slate-50/60 p-4 text-sm">
            <div class="flex justify-between text-slate-500"><span>Subtotal</span><span>{{ money(order.subtotal) }}</span></div>
            <div v-if="order.discount" class="flex justify-between text-slate-500"><span>Discount</span><span>- {{ money(order.discount) }}</span></div>
            <div class="flex justify-between text-lg font-extrabold text-slate-900"><span>Total</span><span>{{ money(order.total_amount) }}</span></div>
          </div>
        </div>

        <aside class="space-y-4">
          <div class="card card-pad">
            <p class="flex items-center gap-2 font-bold text-slate-900"><BuildingStorefrontIcon class="size-5 text-brand-600" /> {{ order.pharmacy?.name }}</p>
            <p class="mt-2 flex items-start gap-1.5 text-sm text-slate-500"><MapPinIcon class="mt-0.5 size-4 shrink-0" /> {{ [order.pharmacy?.address_line, order.pharmacy?.sub_city, order.pharmacy?.city].filter(Boolean).join(', ') }}</p>
            <a :href="`tel:${order.pharmacy?.phone}`" class="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand-700"><PhoneIcon class="size-4" /> {{ phone(order.pharmacy?.phone) }}</a>
          </div>
          <div class="card card-pad space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-slate-500">Fulfilment</span><b>{{ titleCase(order.fulfillment) }}</b></div>
            <div v-if="order.delivery_address" class="text-slate-600">{{ order.delivery_address }}</div>
            <div class="flex justify-between"><span class="text-slate-500">Payment</span><b>{{ meta.paymentLabel(order.payment_method) }}</b></div>
            <div class="flex justify-between"><span class="text-slate-500">Status</span><StatusBadge :status="order.payment_status" /></div>
            <div v-if="order.prescription" class="flex justify-between"><span class="text-slate-500">Prescription</span><b class="font-mono">{{ order.prescription.reference_code }}</b></div>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>
