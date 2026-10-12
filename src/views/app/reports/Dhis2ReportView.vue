<script setup>
import { ref, watch } from 'vue'
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline'
import api, { download } from '@/lib/api'
import { number } from '@/lib/format'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'

const ui = useUiStore()
const month = ref(new Date().toISOString().slice(0, 7))
const report = ref(null)
watch(month, async (m) => {
  report.value = null
  report.value = (await api.get('/reports/dhis2', { params: { month: m } })).data.data
}, { immediate: true })
const exportDhis2 = () => download('/reports/dhis2', { month: month.value, format: 'dhis2' }).catch((e) => ui.error(e.message))
</script>

<template>
  <div>
    <PageHeader title="HMIS / DHIS2 monthly report" eyebrow="Reports · Ministry of Health" subtitle="OPD attendance by age and sex, top diagnoses (ICD-10), laboratory and malaria indicators and prescribing - exported as a DHIS2 dataValueSet.">
      <input v-model="month" type="month" class="input w-44" />
      <button class="btn btn-primary" @click="exportDhis2"><ArrowDownTrayIcon class="size-4" /> DHIS2 JSON</button>
    </PageHeader>

    <div v-if="!report" class="skeleton h-96 rounded-2xl" />
    <template v-else>
      <p class="mb-4 text-sm text-slate-500">{{ report.organisation }} · {{ report.period_label }}<span v-if="!report.org_unit" class="ml-2 font-semibold text-amber-700">Set your DHIS2 org-unit id in Settings before submitting.</span></p>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="OPD visits" :value="number(report.opd.total)" :hint="`${report.opd.new} new · ${report.opd.repeat} repeat`" />
        <StatCard label="Emergency" :value="number(report.opd.emergency)" tone="rose" />
        <StatCard label="Malaria tested" :value="number(report.lab.malaria_tested)" tone="gold" :hint="`${report.lab.malaria_positive} positive · ${report.lab.malaria_positivity_rate}%`" />
        <StatCard label="Prescriptions" :value="number(report.prescriptions.issued)" tone="sky" :hint="`${report.prescriptions.average_items} items per Rx`" />
      </div>
      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <section class="card overflow-hidden">
          <h2 class="border-b border-slate-100 px-5 py-4 font-bold text-slate-900">OPD by age and sex</h2>
          <table class="table text-sm">
            <thead><tr><th>Age group</th><th class="text-right">Male</th><th class="text-right">Female</th><th class="text-right">Total</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(v, group) in report.opd.by_age_sex" :key="group"><td>{{ group }}</td><td class="text-right">{{ v.male }}</td><td class="text-right">{{ v.female }}</td><td class="text-right font-bold">{{ v.male + v.female }}</td></tr>
            </tbody>
          </table>
        </section>
        <section class="card overflow-hidden">
          <h2 class="border-b border-slate-100 px-5 py-4 font-bold text-slate-900">Top diagnoses</h2>
          <table class="table text-sm">
            <thead><tr><th>ICD-10</th><th>Diagnosis</th><th class="text-right">M</th><th class="text-right">F</th><th class="text-right">Total</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="d in report.top_morbidity" :key="d.code"><td class="font-mono text-xs font-bold">{{ d.code }}</td><td>{{ d.name }}</td><td class="text-right">{{ d.male }}</td><td class="text-right">{{ d.female }}</td><td class="text-right font-bold">{{ d.total }}</td></tr>
              <tr v-if="!report.top_morbidity.length"><td colspan="5" class="py-6 text-center text-slate-500">No coded diagnoses this month.</td></tr>
            </tbody>
          </table>
        </section>
      </div>
      <section class="card card-pad mt-6">
        <h2 class="font-bold text-slate-900">Laboratory</h2>
        <p class="mt-1 text-sm text-slate-500">{{ number(report.lab.tests_performed) }} tests performed</p>
        <div class="mt-3 flex flex-wrap gap-2"><span v-for="(n, cat) in report.lab.by_category" :key="cat" class="chip bg-slate-100 capitalize text-slate-700 ring-slate-500/15">{{ cat }} · {{ n }}</span></div>
      </section>
    </template>
  </div>
</template>
