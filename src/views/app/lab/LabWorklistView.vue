<script setup>
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { ArrowPathIcon, BanknotesIcon, CheckBadgeIcon, ShieldCheckIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money } from '@/lib/format'
import { useFormat } from '@/composables/useFormat'
import { useList } from '@/composables/useList'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import LabResultValue from '@/components/clinical/LabResultValue.vue'

const auth = useAuthStore()
const ui = useUiStore()
const { dateTime, relative } = useFormat()

const { rows, meta, extra, loading, filters, page, reload } = useList('/lab-orders', { status: 'open', search: '' }, { perPage: 20 })
const counts = computed(() => extra.value.counts ?? {})
const tabs = computed(() => [
  { value: 'open', label: 'Worklist', count: (counts.value.ordered ?? 0) + (counts.value.collected ?? 0) },
  { value: 'ordered', label: 'Awaiting sample', count: counts.value.ordered ?? 0 },
  { value: 'collected', label: 'In progress', count: counts.value.collected ?? 0 },
  { value: 'completed', label: 'Completed', count: counts.value.completed ?? 0 },
])
const timer = setInterval(reload, 45000)
onBeforeUnmount(() => clearInterval(timer))

/** Draft results keyed by item id. */
const drafts = reactive({})
const busy = reactive({})
watch(rows, (list) => {
  for (const o of list) {
    for (const i of o.items ?? []) drafts[i.id] ??= { result_value: i.result_value ?? '', result_text: i.result_text ?? '', remarks: i.remarks ?? '' }
  }
}, { immediate: true })
const draft = (item) => drafts[item.id] ?? {}

async function run(key, request, success) {
  busy[key] = true
  try {
    const { data } = await request()
    ui.success(data.message ?? success)
    await reload()
  } catch (e) {
    ui.error(e.message)
  } finally {
    busy[key] = false
  }
}

const collect = (order) => run(`c${order.id}`, () => api.post(`/lab-orders/${order.id}/collect`), 'Sample collected')
function saveResult(order, item) {
  const d = draft(item)
  const body = item.test.result_type === 'numeric' ? { result_value: d.result_value, remarks: d.remarks || null } : { result_text: d.result_text, remarks: d.remarks || null }
  run(`r${item.id}`, () => api.post(`/lab-orders/${order.id}/items/${item.id}/result`, body), 'Result saved')
}
const verify = (order, item) => run(`v${item.id}`, () => api.post(`/lab-orders/${order.id}/items/${item.id}/verify`), 'Verified')

</script>

<template>
  <div>
    <PageHeader title="Laboratory" eyebrow="Lab worklist" subtitle="Samples are taken once the patient has paid at the cashier (or is covered by an insurer). Critical values alert the ordering doctor immediately.">
      <RouterLink v-if="auth.can('lab.manage')" :to="{ name: 'app.lab.tests' }" class="btn btn-secondary">Test menu & prices</RouterLink>
      <button class="btn btn-secondary" @click="reload"><ArrowPathIcon class="size-4" :class="loading && 'animate-spin'" /> Refresh</button>
    </PageHeader>

    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <PillTabs v-model="filters.status" :tabs="tabs" />
      <SearchInput v-model="filters.search" placeholder="Patient, card no. or lab no." class="w-72" />
    </div>

    <div v-if="loading && !rows.length" class="grid gap-4 lg:grid-cols-2"><div v-for="i in 4" :key="i" class="skeleton h-56 rounded-2xl" /></div>
    <EmptyState v-else-if="!rows.length" title="No lab orders here" text="New orders from doctors appear automatically." class="card py-14" />

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <article v-for="o in rows" :key="o.id" class="card overflow-hidden" :class="o.priority === 'urgent' && 'ring-2 ring-rose-400'">
        <header class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div class="min-w-0">
            <p class="flex items-center gap-2 font-bold text-slate-900">{{ o.patient?.full_name }} <StatusBadge v-if="o.priority === 'urgent'" status="urgent" /></p>
            <p class="text-xs text-slate-500">{{ o.patient?.mrn || '—' }} · {{ o.patient?.age ?? '?' }}y {{ o.patient?.gender === 'female' ? 'F' : 'M' }} · <span class="font-mono">{{ o.order_number }}</span></p>
            <p class="text-xs text-slate-500">By {{ o.ordered_by }} · {{ relative(o.created_at) }}</p>
            <p v-if="o.clinical_notes" class="mt-1 text-xs text-slate-700">“{{ o.clinical_notes }}”</p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <StatusBadge :status="o.status" />
            <span v-if="o.payment && !o.payment.settled" class="chip bg-amber-50 text-amber-800 ring-amber-600/20"><BanknotesIcon class="size-3.5" /> {{ money(o.payment.balance) }} unpaid</span>
            <span v-else-if="o.payment?.covered" class="chip bg-sky-50 text-sky-700 ring-sky-600/15"><ShieldCheckIcon class="size-3.5" /> Insured</span>
          </div>
        </header>

        <ul class="divide-y divide-slate-100">
          <li v-for="i in o.items" :key="i.id" class="px-5 py-3">
            <div class="flex items-center justify-between gap-2">
              <span class="min-w-0">
                <span class="block truncate text-sm font-semibold">{{ i.test?.name }}</span>
                <span class="text-xs text-slate-400">{{ i.test?.specimen }} · ref {{ i.reference || '—' }}</span>
              </span>
              <LabResultValue :item="i" />
            </div>

            <!-- Result entry -->
            <form v-if="o.status !== 'ordered' && i.status !== 'verified' && auth.can('lab.result')" class="mt-2 flex flex-wrap items-center gap-2" @submit.prevent="saveResult(o, i)">
              <template v-if="i.test?.result_type === 'numeric'">
                <input v-model="draft(i).result_value" type="number" step="any" class="input w-28 py-1.5 text-sm" :placeholder="i.unit || 'value'" required />
              </template>
              <select v-else-if="i.test?.result_type === 'select'" v-model="draft(i).result_text" class="input w-52 py-1.5 text-sm" required>
                <option value="" disabled>Choose…</option>
                <option v-for="opt in i.test.options" :key="opt">{{ opt }}</option>
              </select>
              <select v-else-if="i.test?.result_type === 'positive_negative'" v-model="draft(i).result_text" class="input w-40 py-1.5 text-sm" required>
                <option value="" disabled>Choose…</option>
                <option>Negative</option><option>Positive</option><option>Non-reactive</option><option>Reactive</option>
              </select>
              <input v-else v-model="draft(i).result_text" class="input min-w-0 flex-1 py-1.5 text-sm" placeholder="Findings" required />
              <input v-model="draft(i).remarks" class="input min-w-0 flex-1 py-1.5 text-sm" placeholder="Remarks (optional)" />
              <button class="btn btn-secondary btn-sm" :disabled="busy['r' + i.id]"><AppSpinner v-if="busy['r' + i.id]" /> Save</button>
              <button v-if="i.status === 'resulted' && auth.can('lab.verify')" type="button" class="btn btn-primary btn-sm" :disabled="busy['v' + i.id]" @click="verify(o, i)"><CheckBadgeIcon class="size-4" /> Verify</button>
            </form>
            <p v-if="i.resulted_at" class="mt-1 text-[0.7rem] text-slate-400">Resulted {{ dateTime(i.resulted_at) }}<template v-if="i.verified_at"> · verified {{ dateTime(i.verified_at) }}</template></p>
          </li>
        </ul>

        <footer v-if="o.status === 'ordered' && auth.can('lab.result')" class="no-print flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <button class="btn btn-primary btn-sm" :disabled="busy['c' + o.id]" @click="collect(o)">
            <AppSpinner v-if="busy['c' + o.id]" /> Sample collected
          </button>
        </footer>
      </article>
    </div>
    <AppPagination v-model="page" :meta="meta" class="mt-4" />
  </div>
</template>
