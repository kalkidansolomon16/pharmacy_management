<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDownTrayIcon, DocumentTextIcon, TableCellsIcon } from '@heroicons/vue/24/outline'
import api, { download } from '@/lib/api'
import { daysAgoIso, money, number, titleCase, todayIso } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AreaChart from '@/components/charts/AreaChart.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import BarList from '@/components/charts/BarList.vue'

const auth = useAuthStore()
const meta = useMetaStore()
const ui = useUiStore()
meta.load()

const isHospital = auth.tenantType === 'hospital'
const tabs = isHospital
  ? [{ value: 'prescriptions', label: 'Prescriptions' }]
  : auth.isSuperAdmin ? [{ value: 'sales', label: 'Platform sales' }] : [{ value: 'sales', label: 'Sales' }, { value: 'inventory', label: 'Inventory valuation' }]
const tab = ref(tabs[0].value)

const range = reactive({ from: daysAgoIso(29), to: todayIso(), preset: '29' })
const presets = [{ value: '0', label: 'Today' }, { value: '6', label: '7 days' }, { value: '29', label: '30 days' }, { value: '89', label: '90 days' }, { value: 'custom', label: 'Custom' }]
watch(() => range.preset, (p) => {
  if (p !== 'custom') Object.assign(range, { from: daysAgoIso(Number(p)), to: todayIso() })
})

const tenantId = ref('')
const pharmacies = ref([])
const report = ref(null)
const loading = ref(false)

async function load() {
  loading.value = true
  report.value = null
  try {
    const params = tab.value === 'inventory' ? {} : { from: range.from, to: range.to, tenant_id: tenantId.value || undefined }
    report.value = (await api.get(`/reports/${tab.value}`, { params })).data.data
  } catch (e) {
    ui.error(e.message)
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  load()
  if (auth.isSuperAdmin) pharmacies.value = (await api.get('/admin/tenants', { params: { type: 'pharmacy', status: 'active', per_page: 100 } })).data.data
})
watch([tab, () => range.from, () => range.to, tenantId], load)

function exportAs(format) {
  const params = { format, ...(tab.value === 'inventory' ? {} : { from: range.from, to: range.to, tenant_id: tenantId.value || undefined }) }
  download(`/reports/${tab.value}/export`, params).catch((e) => ui.error(e.message))
}

const paymentColors = { cash: '#059669', telebirr: '#0ea5e9', cbe_birr: '#7c3aed', chapa: '#f59e0b', bank_transfer: '#64748b', insurance: '#e11d48' }
const statusColors = { active: '#10b981', partially_dispensed: '#f97316', dispensed: '#0ea5e9', expired: '#e11d48', cancelled: '#94a3b8' }
const t = computed(() => report.value?.totals ?? {})
const short = (v) => money(v, { compact: true })
</script>

<template>
  <div>
    <PageHeader title="Reports" :eyebrow="auth.tenant?.name ?? 'MedLink Ethiopia'" subtitle="Performance over time. Exports open in Excel (CSV) or as a printable PDF.">
      <button class="btn btn-secondary" @click="exportAs('csv')"><TableCellsIcon class="size-4" /> Excel</button>
      <button class="btn btn-primary" @click="exportAs('pdf')"><DocumentTextIcon class="size-4" /> PDF</button>
    </PageHeader>

    <div class="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <PillTabs v-model="tab" :tabs="tabs" />
      <div v-if="tab !== 'inventory'" class="flex flex-wrap items-center gap-2">
        <select v-if="auth.isSuperAdmin" v-model="tenantId" class="input w-56"><option value="">All pharmacies</option><option v-for="p in pharmacies" :key="p.id" :value="p.id">{{ p.name }}</option></select>
        <div class="flex rounded-xl bg-white p-1 shadow-soft ring-1 ring-slate-200/70">
          <button v-for="p in presets" :key="p.value" class="rounded-lg px-3 py-1.5 text-xs font-semibold transition" :class="range.preset === p.value ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800'" @click="range.preset = p.value">{{ p.label }}</button>
        </div>
        <template v-if="range.preset === 'custom'">
          <input v-model="range.from" type="date" class="input w-40" />
          <input v-model="range.to" type="date" :min="range.from" class="input w-40" />
        </template>
      </div>
    </div>

    <div v-if="loading || !report" class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="i in 4" :key="i" class="skeleton h-32 rounded-2xl" />
      <div class="skeleton h-80 rounded-2xl sm:col-span-2 xl:col-span-4" />
    </div>

    <!-- SALES -->
    <div v-else-if="tab === 'sales'" class="space-y-6">
      <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" :value="money(t.revenue)" :hint="`${number(t.orders)} orders · avg ${money(t.average_basket)}`" />
        <StatCard label="Gross profit" :value="money(t.gross_profit)" tone="gold" :hint="`${t.margin_percent}% margin (FEFO batch cost)`" />
        <StatCard label="Units dispensed" :value="number(t.items_sold)" tone="sky" :hint="`Cost of goods ${money(t.cost_of_goods)}`" />
        <StatCard label="Discounts given" :value="money(t.discount)" tone="violet" />
      </div>
      <div class="grid gap-6 xl:grid-cols-3">
        <section class="card card-pad xl:col-span-2">
          <h2 class="font-bold text-slate-900">Daily revenue</h2>
          <AreaChart class="mt-4" :points="report.daily" :format="(v) => money(v)" />
        </section>
        <section class="card card-pad">
          <h2 class="font-bold text-slate-900">Payment methods</h2>
          <DonutChart class="mt-5" :segments="report.by_payment_method.map((p) => ({ label: meta.paymentLabel(p.payment_method), value: p.revenue, color: paymentColors[p.payment_method] }))" :format="short" center-label="Revenue" />
        </section>
      </div>
      <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section class="card overflow-hidden">
          <div class="px-5 pt-5 pb-3"><h2 class="font-bold text-slate-900">Top medicines by revenue</h2></div>
          <table class="table">
            <thead><tr><th>#</th><th>Medicine</th><th class="text-right">Units</th><th class="text-right">Revenue</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(m, i) in report.top_medicines" :key="m.medicine_id"><td class="text-slate-400">{{ i + 1 }}</td><td class="font-semibold">{{ m.name }} <span class="text-xs font-normal text-slate-400">{{ m.brand_name }}</span></td><td class="text-right">{{ number(m.quantity) }}</td><td class="text-right font-bold">{{ money(m.revenue) }}</td></tr>
              <tr v-if="!report.top_medicines.length"><td colspan="4" class="py-8 text-center text-slate-500">No sales in this period.</td></tr>
            </tbody>
          </table>
        </section>
        <section class="card card-pad">
          <h2 class="mb-4 font-bold text-slate-900">Channel</h2>
          <BarList :items="report.by_channel.map((c) => ({ label: c.channel === 'walk_in' ? 'Walk-in (POS)' : 'Online orders', sub: `${c.orders} orders`, value: c.revenue }))" :format="short" />
        </section>
      </div>
    </div>

    <!-- INVENTORY -->
    <div v-else-if="tab === 'inventory'" class="space-y-6">
      <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stock value (cost)" :value="money(t.stock_cost)" :hint="`${number(t.units)} units · ${t.products} products`" />
        <StatCard label="Retail value" :value="money(t.retail_value)" tone="gold" :hint="`Potential margin ${money(t.retail_value - t.stock_cost)}`" />
        <StatCard label="Low / out of stock" :value="`${t.low_stock} / ${t.out_of_stock}`" tone="rose" />
        <StatCard label="Expired write-offs" :value="money(t.expired_write_off_value)" tone="violet" :hint="`${t.expiring_90_days} batches expire within 90 days`" />
      </div>
      <section class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="table">
            <thead><tr><th>Medicine</th><th class="text-right">In stock</th><th class="text-right">Price</th><th class="text-right">Cost value</th><th class="text-right">Retail value</th><th>Next expiry</th><th>Status</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="r in report.rows" :key="r.id">
                <td><RouterLink :to="{ name: 'app.inventory.item', params: { id: r.id } }" class="font-semibold hover:text-brand-700">{{ r.name }}</RouterLink><p class="text-xs text-slate-400">{{ r.dosage_form }}</p></td>
                <td class="text-right font-semibold">{{ number(r.quantity) }}</td>
                <td class="text-right">{{ money(r.price) }}</td>
                <td class="text-right">{{ money(r.stock_cost) }}</td>
                <td class="text-right font-semibold">{{ money(r.retail_value) }}</td>
                <td class="text-xs text-slate-500">{{ r.nearest_expiry ?? '—' }}</td>
                <td><StatusBadge :status="r.status" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- PRESCRIPTIONS -->
    <div v-else-if="tab === 'prescriptions'" class="space-y-6">
      <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Prescriptions" :value="number(t.prescriptions)" :hint="`${t.patients} patients`" />
        <StatCard label="Dispense rate" :value="`${t.dispense_rate}%`" tone="gold" hint="Filled at a pharmacy" />
        <StatCard label="Units prescribed" :value="number(t.units_prescribed)" tone="sky" />
        <StatCard label="Units dispensed" :value="number(t.units_dispensed)" tone="violet" />
      </div>
      <div class="grid gap-6 xl:grid-cols-3">
        <section class="card card-pad xl:col-span-2">
          <h2 class="font-bold text-slate-900">Prescriptions per day</h2>
          <AreaChart class="mt-4" :points="report.daily" color="#0284c7" :format="(v) => `${v} prescriptions`" />
        </section>
        <section class="card card-pad">
          <h2 class="font-bold text-slate-900">By status</h2>
          <DonutChart class="mt-5" :segments="Object.entries(report.by_status).map(([k, v]) => ({ label: titleCase(k), value: v, color: statusColors[k] }))" center-label="Issued" />
        </section>
      </div>
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="card card-pad">
          <h2 class="mb-4 font-bold text-slate-900">Most prescribed</h2>
          <BarList :items="report.top_medicines.map((m) => ({ label: m.name, sub: `${m.quantity} units`, value: m.times }))" color="from-sky-400 to-sky-600" :format="(v) => `${v}×`" />
        </section>
        <section class="card card-pad">
          <h2 class="mb-4 font-bold text-slate-900">By prescriber</h2>
          <BarList :items="report.by_doctor.map((d) => ({ label: d.name, value: d.total }))" color="from-violet-400 to-violet-600" />
        </section>
      </div>
    </div>
  </div>
</template>
