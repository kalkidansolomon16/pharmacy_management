<script setup>
import { computed } from 'vue'
import { ArchiveBoxXMarkIcon, BanknotesIcon, ClockIcon, ShoppingBagIcon } from '@heroicons/vue/24/outline'
import { money, number } from '@/lib/format'
import { useMetaStore } from '@/stores/meta'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import AreaChart from '@/components/charts/AreaChart.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import BarList from '@/components/charts/BarList.vue'

const props = defineProps({ data: { type: Object, required: true } })
const meta = useMetaStore()
meta.load()

const s = computed(() => props.data.stats)
const trend = computed(() => (s.value.sales_yesterday ? ((s.value.sales_today - s.value.sales_yesterday) / s.value.sales_yesterday) * 100 : null))
const fourteenDays = computed(() => props.data.daily_sales.reduce((a, p) => a + p.value, 0))

const paymentColors = { cash: '#059669', telebirr: '#0ea5e9', cbe_birr: '#7c3aed', chapa: '#f59e0b', bank_transfer: '#64748b', insurance: '#e11d48' }
const segments = computed(() => props.data.by_payment_method.map((p) => ({ label: meta.paymentLabel(p.payment_method), value: p.revenue, color: paymentColors[p.payment_method] ?? '#94a3b8' })))
const short = (v) => money(v, { compact: true })
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Sales today" :value="money(s.sales_today)" :icon="BanknotesIcon" :trend="trend" :hint="`${s.orders_today} sales · vs yesterday`" />
      <StatCard label="Open online orders" :value="number(s.open_orders)" :icon="ShoppingBagIcon" tone="sky" :hint="`${s.pending_orders} awaiting confirmation`" :to="{ name: 'app.orders', query: { status: 'open' } }" />
      <StatCard label="Low / out of stock" :value="`${s.low_stock}`" :icon="ArchiveBoxXMarkIcon" tone="gold" :hint="`${s.out_of_stock} out of stock`" :to="{ name: 'app.inventory', query: { filter: 'low_stock' } }" />
      <StatCard label="Expiring ≤ 90 days" :value="number(s.expiring)" :icon="ClockIcon" tone="rose" hint="Sell first (FEFO) or return" :to="{ name: 'app.expiry' }" />
    </div>

    <div class="grid gap-6 xl:grid-cols-3">
      <section class="card card-pad xl:col-span-2">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-bold text-slate-900">Sales, last 14 days</h2>
            <p class="text-sm text-slate-500">{{ money(fourteenDays) }} total · 30-day margin <b class="text-brand-700">{{ s.margin_30d }}%</b></p>
          </div>
          <RouterLink :to="{ name: 'app.reports' }" class="btn btn-secondary btn-sm">Full report</RouterLink>
        </div>
        <AreaChart class="mt-4" :points="data.daily_sales" :format="(v) => money(v)" />
      </section>
      <section class="card card-pad">
        <h2 class="font-bold text-slate-900">How customers pay</h2>
        <p class="text-sm text-slate-500">Last 30 days · {{ money(s.revenue_30d) }}</p>
        <DonutChart class="mt-5" :segments="segments" :format="short" center-label="Revenue" />
      </section>
    </div>

    <div class="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <section class="card card-pad">
        <h2 class="mb-4 font-bold text-slate-900">Top sellers (30 days)</h2>
        <BarList :items="data.top_medicines.map((m) => ({ label: m.name, sub: `${number(m.quantity)} units`, value: m.revenue }))" :format="short" />
        <p v-if="!data.top_medicines.length" class="text-sm text-slate-500">No sales yet.</p>
      </section>

      <section class="card overflow-hidden">
        <div class="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 class="font-bold text-slate-900">Running low</h2>
          <RouterLink :to="{ name: 'app.inventory', query: { filter: 'low_stock' } }" class="text-xs font-semibold text-brand-700 hover:underline">View all</RouterLink>
        </div>
        <ul class="divide-y divide-slate-100">
          <li v-for="l in data.low_stock" :key="l.id">
            <RouterLink :to="{ name: 'app.inventory.item', params: { id: l.id } }" class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
              <MedicineAvatar :form="l.medicine.dosage_form" size="sm" />
              <span class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{{ l.medicine.display_name }}</span>
              <span class="text-right">
                <span class="block text-sm font-bold" :class="l.available_quantity ? 'text-amber-600' : 'text-rose-600'">{{ l.available_quantity }}</span>
                <span class="block text-[0.68rem] text-slate-400">reorder at {{ l.reorder_level }}</span>
              </span>
            </RouterLink>
          </li>
          <li v-if="!data.low_stock.length" class="px-5 py-8 text-center text-sm text-slate-500">Stock levels look healthy 👍</li>
        </ul>
      </section>

      <section class="card overflow-hidden">
        <div class="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 class="font-bold text-slate-900">Expiring soon</h2>
          <RouterLink :to="{ name: 'app.expiry' }" class="text-xs font-semibold text-brand-700 hover:underline">Expiry tracker</RouterLink>
        </div>
        <ul class="divide-y divide-slate-100">
          <li v-for="b in data.expiring" :key="b.id" class="flex items-center gap-3 px-5 py-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-xl text-center text-[0.65rem] leading-tight font-extrabold" :class="b.days_to_expiry <= 30 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'">
              {{ b.days_to_expiry }}<br />days
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-slate-800">{{ b.listing?.medicine?.display_name }}</span>
              <span class="block text-xs text-slate-500">Batch {{ b.batch_number }} · {{ b.quantity }} units · <DateText :value="b.expiry_date" /></span>
            </span>
          </li>
          <li v-if="!data.expiring.length" class="px-5 py-8 text-center text-sm text-slate-500">Nothing expires in the next 90 days.</li>
        </ul>
      </section>
    </div>

    <section class="card overflow-hidden">
      <div class="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 class="font-bold text-slate-900">Latest orders & sales</h2>
        <RouterLink :to="{ name: 'app.orders' }" class="text-xs font-semibold text-brand-700 hover:underline">All orders</RouterLink>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Order</th><th>Customer</th><th>Channel</th><th>Status</th><th class="text-right">Total</th><th>When</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="o in data.recent_orders" :key="o.id" class="cursor-pointer" @click="$router.push({ name: 'app.order', params: { id: o.id } })">
              <td class="font-mono text-xs font-bold">{{ o.order_number }}</td>
              <td>{{ o.customer_name }}</td>
              <td><StatusBadge :status="o.channel" :dot="false" /></td>
              <td><StatusBadge :status="o.status" /></td>
              <td class="text-right font-semibold">{{ money(o.total_amount) }}</td>
              <td class="text-slate-500"><DateText :value="o.created_at" relative /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
