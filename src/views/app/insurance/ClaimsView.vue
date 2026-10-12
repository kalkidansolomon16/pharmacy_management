<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ArrowDownTrayIcon, CheckIcon, DocumentPlusIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import api, { download } from '@/lib/api'
import { money, daysAgoIso, todayIso } from '@/lib/format'
import { useFormat } from '@/composables/useFormat'
import { useList } from '@/composables/useList'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import StatCard from '@/components/ui/StatCard.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const meta = useMetaStore()
const ui = useUiStore()
const { date, relative } = useFormat()
meta.load()
const canManage = auth.can('insurance.claims')

const tab = ref('claims')
const claims = useList('/claims', { status: '' }, { syncQuery: false })
const approvals = useList('/authorizations', { status: 'pending' }, { syncQuery: false })
const aging = ref(null)
const payers = ref([])
onMounted(async () => {
  payers.value = (await api.get('/payers', { params: { per_page: 100 } })).data.data
  aging.value = (await api.get('/receivables')).data.data
})
const tabs = computed(() => [
  { value: 'claims', label: 'Monthly claims' },
  { value: 'approvals', label: 'Pre-authorizations', count: approvals.filters.status === 'pending' ? approvals.meta.value.total : undefined },
  { value: 'aging', label: 'Receivables aging' },
])

// Generate a claim for a period
const generating = ref(false)
const gen = reactive({ payer_id: '', from: daysAgoIso(30), to: todayIso(), busy: false })
async function generate() {
  gen.busy = true
  try {
    const { data } = await api.post('/claims', { payer_id: gen.payer_id, from: gen.from, to: gen.to })
    ui.success(data.message)
    generating.value = false
    claims.reload()
  } catch (e) {
    ui.error(e.message)
  } finally {
    gen.busy = false
  }
}

async function submitClaim(c) {
  try {
    ui.success((await api.post(`/claims/${c.id}/submit`)).data.message)
    claims.reload()
  } catch (e) {
    ui.error(e.message)
  }
}

const paying = ref(null)
const pay = reactive({ amount: 0, rejected: 0, method: 'bank_transfer', reference: '', busy: false })
function openPay(c) {
  paying.value = c
  Object.assign(pay, { amount: c.outstanding, rejected: 0, method: 'bank_transfer', reference: '' })
}
async function recordPay() {
  pay.busy = true
  try {
    ui.success((await api.post(`/claims/${paying.value.id}/payments`, { ...pay, reference: pay.reference || null })).data.message)
    paying.value = null
    claims.reload()
    aging.value = (await api.get('/receivables')).data.data
  } catch (e) {
    ui.error(e.message)
  } finally {
    pay.busy = false
  }
}

async function decide(a, approved) {
  const input = await ui.confirm({
    title: approved ? `Approve ${money(a.amount)}?` : 'Decline this request?',
    message: approved ? 'Enter the approval / authorization number given by the insurer.' : 'The invoice returns to the patient as a cash bill.',
    confirmText: approved ? 'Record approval' : 'Decline',
    danger: !approved,
    input: { label: approved ? 'Authorization number' : 'Reason', required: approved },
  })
  if (input === false) return
  try {
    const body = approved ? { approved: true, reference_number: input } : { approved: false, notes: typeof input === 'string' ? input : null }
    ui.success((await api.post(`/authorizations/${a.id}/decide`, body)).data.message)
    approvals.reload()
  } catch (e) {
    ui.error(e.message)
  }
}

const claimColumns = [
  { key: 'number', label: 'Claim' }, { key: 'payer', label: 'Payer' }, { key: 'period', label: 'Period' },
  { key: 'amount', label: 'Claimed', align: 'right' }, { key: 'outstanding', label: 'Outstanding', align: 'right' }, { key: 'status', label: 'Status' }, { key: 'actions', label: '', align: 'right' },
]
const approvalColumns = [
  { key: 'invoice', label: 'Invoice' }, { key: 'payer', label: 'Payer' }, { key: 'amount', label: 'Insurer share', align: 'right' },
  { key: 'requested', label: 'Requested' }, { key: 'status', label: 'Status' }, { key: 'actions', label: '', align: 'right' },
]
</script>

<template>
  <div>
    <PageHeader title="Claims & receivables" eyebrow="Insurance" subtitle="Bundle each payer's covered invoices into a monthly claim, follow up approvals, and see who owes what and for how long.">
      <button v-if="canManage" class="btn btn-primary" @click="generating = true"><DocumentPlusIcon class="size-4" /> Prepare claim</button>
    </PageHeader>

    <div v-if="aging" class="mb-6 grid gap-4 sm:grid-cols-3">
      <StatCard label="Owed by insurers" :value="money(aging.payer_total)" tone="sky" />
      <StatCard label="Owed by patients" :value="money(aging.patient_total)" :hint="`${aging.patient_invoices} open bills`" tone="gold" />
      <StatCard label="Over credit limit" :value="String(aging.payers.filter((p) => p.over_limit).length)" :tone="aging.payers.some((p) => p.over_limit) ? 'rose' : 'brand'" />
    </div>

    <PillTabs v-model="tab" :tabs="tabs" class="mb-4" />

    <div v-if="tab === 'claims'" class="card overflow-hidden">
      <DataTable :columns="claimColumns" :rows="claims.rows.value" :loading="claims.loading.value" empty-title="No claims yet" empty-text="Prepare a claim to bundle a month of covered invoices.">
        <template #cell-number="{ row }"><span class="font-mono text-xs font-bold">{{ row.claim_number }}</span><p class="text-xs text-slate-500">{{ row.invoices_count }} invoices</p></template>
        <template #cell-payer="{ row }">{{ row.payer?.name }}</template>
        <template #cell-period="{ row }"><span class="text-xs">{{ date(row.period_start) }} – {{ date(row.period_end) }}</span></template>
        <template #cell-amount="{ row }">{{ money(row.total_amount) }}<p v-if="row.rejected_amount" class="text-xs text-rose-600">rejected {{ money(row.rejected_amount) }}</p></template>
        <template #cell-outstanding="{ row }"><b :class="row.outstanding > 0 && 'text-rose-600'">{{ money(row.outstanding) }}</b></template>
        <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1">
            <button class="btn btn-ghost btn-sm" title="Claim form (PDF)" @click="download(`/claims/${row.id}/export`, { format: 'pdf' }).catch((e) => ui.error(e.message))"><ArrowDownTrayIcon class="size-4" /> PDF</button>
            <button class="btn btn-ghost btn-sm" @click="download(`/claims/${row.id}/export`, { format: 'csv' }).catch((e) => ui.error(e.message))">CSV</button>
            <button v-if="canManage && row.status === 'draft'" class="btn btn-secondary btn-sm" @click="submitClaim(row)"><PaperAirplaneIcon class="size-4" /> Submit</button>
            <button v-if="canManage && ['submitted', 'partially_paid'].includes(row.status)" class="btn btn-primary btn-sm" @click="openPay(row)">Record payment</button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="claims.page.value" :meta="claims.meta.value" />
    </div>

    <div v-else-if="tab === 'approvals'" class="card overflow-hidden">
      <div class="border-b border-slate-100 p-4">
        <select v-model="approvals.filters.status" class="input w-48"><option value="pending">Pending</option><option value="approved">Approved</option><option value="declined">Declined</option><option value="all">All</option></select>
      </div>
      <DataTable :columns="approvalColumns" :rows="approvals.rows.value" :loading="approvals.loading.value" empty-title="No approval requests">
        <template #cell-invoice="{ row }"><span class="font-mono text-xs font-bold">{{ row.invoice?.invoice_number }}</span><p class="text-xs text-slate-500">{{ row.invoice?.customer_name }} · total {{ money(row.invoice?.total) }}</p></template>
        <template #cell-payer="{ row }">{{ row.payer?.name }}</template>
        <template #cell-amount="{ row }"><b>{{ money(row.amount) }}</b></template>
        <template #cell-requested="{ row }"><span class="text-xs">{{ relative(row.created_at) }}<template v-if="row.requested_by"> · {{ row.requested_by }}</template></span></template>
        <template #cell-status="{ row }"><StatusBadge :status="row.status" /><p v-if="row.reference_number" class="font-mono text-xs text-slate-500">{{ row.reference_number }}</p></template>
        <template #cell-actions="{ row }">
          <div v-if="canManage && row.status === 'pending'" class="flex justify-end gap-1">
            <button class="btn btn-ghost btn-sm text-rose-600" @click="decide(row, false)"><XMarkIcon class="size-4" /> Decline</button>
            <button class="btn btn-primary btn-sm" @click="decide(row, true)"><CheckIcon class="size-4" /> Approve</button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="approvals.page.value" :meta="approvals.meta.value" />
    </div>

    <div v-else class="card overflow-hidden">
      <div v-if="!aging" class="skeleton m-4 h-40" />
      <table v-else class="table">
        <thead><tr><th>Payer</th><th class="text-right">0–30 days</th><th class="text-right">31–60</th><th class="text-right">61–90</th><th class="text-right">90+</th><th class="text-right">Total</th></tr></thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="r in aging.payers" :key="r.payer.id">
            <td><p class="font-semibold">{{ r.payer.name }}</p><p class="text-xs text-slate-500">{{ r.invoices }} invoices<span v-if="r.over_limit" class="ml-1 font-bold text-rose-600">· over credit limit</span></p></td>
            <td class="text-right">{{ money(r.buckets['0_30'], { symbol: '' }) }}</td>
            <td class="text-right">{{ money(r.buckets['31_60'], { symbol: '' }) }}</td>
            <td class="text-right" :class="r.buckets['61_90'] && 'text-amber-700'">{{ money(r.buckets['61_90'], { symbol: '' }) }}</td>
            <td class="text-right" :class="r.buckets['90_plus'] && 'font-bold text-rose-600'">{{ money(r.buckets['90_plus'], { symbol: '' }) }}</td>
            <td class="text-right font-bold">{{ money(r.total) }}</td>
          </tr>
          <tr v-if="!aging.payers.length"><td colspan="6" class="py-10 text-center text-sm text-slate-500">No insurer balances outstanding.</td></tr>
        </tbody>
      </table>
    </div>

    <AppModal :open="generating" title="Prepare a claim" subtitle="All covered, unclaimed invoices of the payer in the period are bundled into one claim." @close="generating = false">
      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="Payer" class="sm:col-span-2"><select v-model="gen.payer_id" class="input"><option value="" disabled>Choose…</option><option v-for="p in payers" :key="p.id" :value="p.id">{{ p.name }}</option></select></FormField>
        <FormField label="From"><input v-model="gen.from" type="date" class="input" /></FormField>
        <FormField label="To"><input v-model="gen.to" type="date" class="input" /></FormField>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="generating = false">Cancel</button>
        <button class="btn btn-primary" :disabled="!gen.payer_id || gen.busy" @click="generate"><AppSpinner v-if="gen.busy" /> Prepare claim</button>
      </template>
    </AppModal>

    <AppModal :open="!!paying" title="Record claim payment" :subtitle="paying ? `${paying.claim_number} · outstanding ${money(paying.outstanding)}` : ''" @close="paying = null">
      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount received (ETB)"><input v-model.number="pay.amount" type="number" min="0" step="0.01" class="input" /></FormField>
        <FormField label="Rejected by payer (ETB)" hint="What the insurer refused to pay. It is written off as a loss and no longer counted as owed."><input v-model.number="pay.rejected" type="number" min="0" step="0.01" class="input" /></FormField>
        <FormField label="Method"><select v-model="pay.method" class="input"><option v-for="m in meta.paymentMethods" :key="m.value" :value="m.value">{{ m.label }}</option></select></FormField>
        <FormField label="Reference"><input v-model="pay.reference" class="input font-mono" placeholder="Cheque / transfer no." /></FormField>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="paying = null">Cancel</button>
        <button class="btn btn-primary" :disabled="pay.busy" @click="recordPay"><AppSpinner v-if="pay.busy" /> Save</button>
      </template>
    </AppModal>
  </div>
</template>
