<script setup>
/** Thermal-receipt style summary of an order; printed with window.print(). */
import { money, phone } from '@/lib/format'
import { formatEthiopian } from '@/lib/ethiopianCalendar'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'

defineProps({ order: { type: Object, required: true } })
const auth = useAuthStore()
const meta = useMetaStore()
</script>

<template>
  <div class="print-area mx-auto w-full max-w-xs rounded-2xl border border-dashed border-slate-300 bg-white p-5 font-mono text-xs text-slate-800">
    <div class="text-center">
      <p class="text-sm font-bold">{{ auth.tenant?.name }}</p>
      <p>{{ [auth.tenant?.sub_city, auth.tenant?.city].filter(Boolean).join(', ') }}</p>
      <p>Tel: {{ phone(auth.tenant?.phone) }}</p>
      <p v-if="auth.tenant?.tin_number">TIN: {{ auth.tenant.tin_number }}</p>
    </div>
    <div class="my-3 border-t border-dashed border-slate-300" />
    <p>Receipt: {{ order.order_number }}</p>
    <p>Date: {{ new Date(order.fulfilled_at || order.created_at).toLocaleString('en-GB') }}</p>
    <p class="font-am">{{ formatEthiopian(order.fulfilled_at || order.created_at, 'am') }}</p>
    <p>Customer: {{ order.customer_name }}</p>
    <p v-if="order.prescription">Rx: {{ order.prescription.reference_code }}</p>
    <div class="my-3 border-t border-dashed border-slate-300" />
    <div v-for="i in order.items" :key="i.id" class="mb-1.5">
      <p class="font-bold">{{ i.medicine?.display_name }}</p>
      <p class="flex justify-between"><span>{{ i.fulfilled_quantity || i.quantity }} x {{ money(i.unit_price, { symbol: '' }) }}</span><span>{{ money(i.line_total, { symbol: '' }) }}</span></p>
    </div>
    <div class="my-3 border-t border-dashed border-slate-300" />
    <p class="flex justify-between"><span>Subtotal</span><span>{{ money(order.subtotal, { symbol: '' }) }}</span></p>
    <p v-if="order.discount" class="flex justify-between"><span>Discount</span><span>-{{ money(order.discount, { symbol: '' }) }}</span></p>
    <p class="flex justify-between text-sm font-bold"><span>TOTAL (ETB)</span><span>{{ money(order.total_amount, { symbol: '' }) }}</span></p>
    <p class="mt-1">Paid by: {{ meta.paymentLabel(order.payment_method) }}</p>
    <div class="my-3 border-t border-dashed border-slate-300" />
    <p class="text-center">Served by {{ order.created_by || auth.user?.name }}</p>
    <p class="mt-1 text-center font-am">እናመሰግናለን! · Thank you, get well soon</p>
  </div>
</template>
