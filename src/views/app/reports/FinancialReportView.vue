<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline'
import api, { download } from '@/lib/api'
import { daysAgoIso, money, number, titleCase, todayIso } from '@/lib/format'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import AreaChart from '@/components/charts/AreaChart.vue'
import BarList from '@/components/charts/BarList.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const meta = useMetaStore()
const ui = useUiStore()
meta.load()
const range = reactive({ from: daysAgoIso(29), to: todayIso() })
const report = ref(null)
async function load() {
  report.value = (await api.get('/reports/financial', { params: range })).data.data
}
watch(range, load, { immediate: true })

const shortMoney = (v) => money(v, { compact: true })
const departments = computed(() => (report.value?.by_department ?? []).map((d) => ({ label: titleCase(d.department), value: d.revenue, sub: `${d.lines} lines` })))
const methods = computed(() => (report.value?.by_payment_method ?? []).map((m) => ({ label: meta.paymentLabel(m.method), value: m.amount, sub: `${m.count} payments` })))
const exportAs = (format) => download('/reports/financial/export', { ...range, format }).catch((e) => ui.error(e.message))
</script>

<template>
  <div>
    <PageHeader title="Financial report" eyebrow="Reports" subtitle="Invoiced vs collected, tax (VAT / TOT) for your Ministry of Revenue declaration, insurer share, cashiers and e-invoice status.">
      <input v-model="range.from" type="date" class="input w-40" />
      <input v-model="range.to" type="date" class="input w-40" />
      <button class="btn btn-secondary" @click="exportAs('csv')"><ArrowDownTrayIcon class="size-4" /> Excel (CSV)</button>
      <button class="btn btn-primary" @click="exportAs('pdf')"><ArrowDownTrayIcon class="size-4" /> PDF</button>
    </PageHeader>

    <div v-if="!report" class="skeleton h-96 rounded-2xl" />
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoiced" :value="money(report.totals.invoiced)" :hint="`${number(report.totals.invoices)} invoices`" />
        <StatCard label="Collected" :value="money(report.totals.collected)" tone="sky" />
        <StatCard label="Tax collected" :value="money(report.totals.tax_collected)" tone="gold" hint="declare to MoR" />
        <StatCard label="Insurer share" :value="money(report.totals.payer_share)" tone="violet" :hint="`discounts ${money(report.totals.discounts)} · ${report.totals.voided} voided`" />
      </div>
      <div class="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <section class="card card-pad"><h2 class="font-bold text-slate-900">Daily invoiced</h2><AreaChart :points="report.daily" :format="shortMoney" class="mt-4" /></section>
        <section class="card card-pad space-y-6">
          <div><h2 class="font-bold text-slate-900">By department</h2><BarList :items="departments" :format="shortMoney" class="mt-3" /></div>
          <div><h2 class="font-bold text-slate-900">By payment method</h2><BarList :items="methods" :format="shortMoney" color="from-sky-400 to-sky-600" class="mt-3" /></div>
        </section>
      </div>
      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <section class="card overflow-hidden">
          <h2 class="border-b border-slate-100 px-5 py-4 font-bold text-slate-900">Cashiers</h2>
          <table class="table text-sm"><tbody class="divide-y divide-slate-100">
            <tr v-for="c in report.by_cashier" :key="c.cashier"><td class="font-semibold">{{ c.cashier }}</td><td class="text-right">{{ c.count }} payments</td><td class="text-right font-bold">{{ money(c.amount) }}</td></tr>
            <tr v-if="!report.by_cashier.length"><td class="py-6 text-center text-slate-500">No payments.</td></tr>
          </tbody></table>
        </section>
        <section class="card card-pad">
          <h2 class="font-bold text-slate-900">e-Invoice registration</h2>
          <div class="mt-4 flex flex-wrap gap-3">
            <div v-for="(n, status) in report.fiscal" :key="status" class="rounded-xl bg-slate-50 px-4 py-3"><StatusBadge :status="status" /><p class="mt-1 text-2xl font-extrabold">{{ n }}</p></div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
