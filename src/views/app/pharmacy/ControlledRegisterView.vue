<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ArrowDownTrayIcon, LockClosedIcon } from '@heroicons/vue/24/outline'
import api, { download } from '@/lib/api'
import { daysAgoIso, todayIso } from '@/lib/format'
import { useFormat } from '@/composables/useFormat'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const ui = useUiStore()
const { dateTime } = useFormat()
const listings = ref([])
const loading = ref(true)
const selected = ref(null)
const ledger = ref(null)
const range = reactive({ from: daysAgoIso(90), to: todayIso() })

onMounted(async () => {
  try {
    listings.value = (await api.get('/controlled-register')).data.data
    if (listings.value.length) open(listings.value[0])
  } finally {
    loading.value = false
  }
})

async function open(l) {
  selected.value = l
  ledger.value = null
  ledger.value = (await api.get(`/controlled-register/${l.id}`, { params: range })).data.data
}
const exportAs = (format) => download(`/controlled-register/${selected.value.id}`, { ...range, format }).catch((e) => ui.error(e.message))
</script>

<template>
  <div>
    <PageHeader title="Controlled drugs register" eyebrow="EFDA compliance" subtitle="Running balance of every narcotic and psychotropic medicine: each receipt and issue with batch, prescription, patient and prescriber - ready for EFDA inspection.">
      <template v-if="selected">
        <button class="btn btn-secondary" @click="exportAs('csv')"><ArrowDownTrayIcon class="size-4" /> CSV</button>
        <button class="btn btn-primary" @click="exportAs('pdf')"><ArrowDownTrayIcon class="size-4" /> PDF register</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="skeleton h-80 rounded-2xl" />
    <EmptyState v-else-if="!listings.length" title="No controlled medicines in stock" text="Tramadol, diazepam, phenobarbital and similar items appear here once listed." class="card py-14" />

    <div v-else class="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside class="card h-fit overflow-hidden">
        <button v-for="l in listings" :key="l.id" class="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0" :class="selected?.id === l.id ? 'bg-violet-50' : 'hover:bg-slate-50'" @click="open(l)">
          <LockClosedIcon class="size-5 shrink-0 text-violet-600" />
          <span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold">{{ l.medicine.display_name }}</span><span class="text-xs text-slate-500">{{ l.available_quantity }} on hand</span></span>
        </button>
      </aside>

      <section class="card overflow-hidden">
        <div class="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <label class="text-xs font-semibold text-slate-500">From<input v-model="range.from" type="date" class="input mt-1" /></label>
          <label class="text-xs font-semibold text-slate-500">To<input v-model="range.to" type="date" class="input mt-1" /></label>
          <button class="btn btn-secondary" @click="open(selected)">Apply</button>
        </div>
        <div v-if="!ledger" class="skeleton m-4 h-60" />
        <template v-else>
          <div class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">Opening</p><p class="text-xl font-extrabold">{{ ledger.opening_balance }}</p></div>
            <div class="rounded-xl bg-emerald-50 p-3"><p class="text-xs text-emerald-700">Received</p><p class="text-xl font-extrabold text-emerald-800">{{ ledger.total_received }}</p></div>
            <div class="rounded-xl bg-sky-50 p-3"><p class="text-xs text-sky-700">Issued</p><p class="text-xl font-extrabold text-sky-800">{{ ledger.total_issued }}</p></div>
            <div class="rounded-xl p-3" :class="ledger.closing_balance === ledger.stock_on_hand ? 'bg-violet-50' : 'bg-rose-50'">
              <p class="text-xs opacity-70">Closing / on hand</p>
              <p class="text-xl font-extrabold">{{ ledger.closing_balance }} <span class="text-sm">/ {{ ledger.stock_on_hand }}</span></p>
            </div>
          </div>
          <div class="overflow-x-auto scrollbar-thin">
            <table class="table text-sm">
              <thead><tr><th>Date</th><th>Type</th><th class="text-right">In</th><th class="text-right">Out</th><th class="text-right">Balance</th><th>Batch</th><th>Patient / Rx</th><th>Prescriber</th><th>By</th></tr></thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(e, i) in ledger.entries" :key="i">
                  <td class="whitespace-nowrap text-xs">{{ dateTime(e.date) }}</td>
                  <td><StatusBadge :status="e.type" :dot="false" /></td>
                  <td class="text-right text-emerald-700">{{ e.received || '' }}</td>
                  <td class="text-right text-sky-700">{{ e.issued || '' }}</td>
                  <td class="text-right font-bold">{{ e.balance }}</td>
                  <td class="font-mono text-xs">{{ e.batch }}</td>
                  <td class="text-xs">{{ e.patient || '—' }}<span v-if="e.patient_mrn" class="text-slate-400"> ({{ e.patient_mrn }})</span><p v-if="e.prescription" class="font-mono">{{ e.prescription }}</p></td>
                  <td class="text-xs">{{ e.prescriber || '—' }}<p v-if="e.facility" class="text-slate-400">{{ e.facility }}</p></td>
                  <td class="text-xs">{{ e.recorded_by }}</td>
                </tr>
                <tr v-if="!ledger.entries.length"><td colspan="9" class="py-8 text-center text-sm text-slate-500">No movements in this period.</td></tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>
