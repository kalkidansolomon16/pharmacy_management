<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDownTrayIcon, CircleStackIcon, PencilSquareIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { useRoute } from 'vue-router'
import api, { download } from '@/lib/api'
import { money } from '@/lib/format'
import { trialLabel } from '@/lib/trial'
import { useFormat } from '@/composables/useFormat'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const meta = useMetaStore()
const ui = useUiStore()
const { date, dateTime } = useFormat()
meta.load()

const route = useRoute()
const tab = ref(route.hash === '#plan-requests' ? 'requests' : 'subscriptions')
const tabs = computed(() => [
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'requests', label: pendingRequests.value ? `Plan change requests (${pendingRequests.value})` : 'Plan change requests' },
  { value: 'plans', label: 'Plans' },
  ...(auth.can('platform.backups') ? [{ value: 'backups', label: 'Backups' }] : []),
])
const MODULES = ['pharmacy', 'clinical', 'lab', 'billing', 'insurance']

const subs = useList('/admin/subscriptions', {}, { syncQuery: false })
const plans = ref([])
const loadPlans = async () => (plans.value = (await api.get('/admin/plans')).data.data)
const backups = ref([])
const loadBackups = async () => (backups.value = (await api.get('/admin/backups')).data.data)
// Organizations asking to upgrade / downgrade
const requests = ref([])
const requestsMeta = ref({})
const requestsPage = ref(1)
const requestsFilter = ref('open')
const pendingRequests = computed(() => requestsMeta.value.pending ?? 0)
const loadRequests = async () => {
  const { data } = await api.get('/admin/plan-change-requests', { params: { page: requestsPage.value, status: requestsFilter.value || undefined } })
  requests.value = data.data
  requestsMeta.value = data.meta
}
watch(requestsFilter, () => (requestsPage.value === 1 ? loadRequests() : (requestsPage.value = 1)))
watch(requestsPage, loadRequests)
const deciding = ref(null)
async function decide(r, approve) {
  const answer = await ui.confirm(approve
    ? {
        title: `Approve the ${r.direction} for ${r.tenant?.name}?`,
        message: r.direction === 'downgrade' && r.subscription?.status === 'active'
          ? `They move from ${r.from_plan?.name} to ${r.to_plan.name} when their paid period ends (${date(r.subscription.ends_at)}).`
          : `They move from ${r.from_plan?.name ?? 'no plan'} to ${r.to_plan.name} now (${money(r.to_plan.price_monthly)} / month from their next payment).`,
        confirmText: 'Approve',
        input: { label: 'Note to the organization (optional)', required: false },
      }
    : { title: `Reject the request from ${r.tenant?.name}?`, message: 'They will see the reason in the app and by email.', confirmText: 'Reject', danger: true, input: { label: 'Reason', required: true } })
  if (!answer) return
  deciding.value = r.id
  try {
    const note = typeof answer === 'string' && answer.trim() ? answer.trim() : null
    const res = approve
      ? await api.post(`/admin/plan-change-requests/${r.id}/approve`, { note })
      : await api.post(`/admin/plan-change-requests/${r.id}/reject`, { reason: note })
    ui.success(res.data.message)
    loadRequests()
    subs.reload()
  } catch (e) {
    ui.error(e.message)
  } finally {
    deciding.value = null
  }
}
const REQUEST_STATUS = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-300',
  scheduled: 'bg-sky-100 text-sky-800 ring-sky-300',
  applied: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  rejected: 'bg-rose-100 text-rose-800 ring-rose-300',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-300',
}

onMounted(() => {
  loadPlans()
  loadRequests()
  if (auth.can('platform.backups')) loadBackups()
})

// Record a subscription payment (telebirr / CBE Birr / bank)
const paying = ref(null)
const pay = reactive({ months: 1, amount: 0, method: 'telebirr', reference: '', plan_id: '', busy: false })
function openPay(s) {
  paying.value = s
  Object.assign(pay, { months: 1, amount: s.plan?.price_monthly ?? 0, method: 'telebirr', reference: '', plan_id: s.plan?.id ?? '' })
}
watch(() => [pay.months, pay.plan_id], () => {
  const plan = plans.value.find((p) => p.id === pay.plan_id)
  if (plan) pay.amount = plan.price_monthly * pay.months
})
async function savePay() {
  pay.busy = true
  try {
    ui.success((await api.post(`/admin/subscriptions/${paying.value.id}/payments`, { ...pay, reference: pay.reference || null, plan_id: pay.plan_id || null })).data.message ?? 'Payment recorded')
    paying.value = null
    subs.reload()
  } catch (e) {
    ui.error(e.message)
  } finally {
    pay.busy = false
  }
}
async function setStatus(s, status) {
  try {
    await api.put(`/admin/subscriptions/${s.id}`, { status })
    subs.reload()
  } catch (e) {
    ui.error(e.message)
  }
}

// Plans
const editingPlan = ref(null)
const planBlank = { code: '', name: '', description: '', price_monthly: 0, trial_days: 30, modules: ['pharmacy', 'billing'], max_users: 10, max_branches: 1, max_stores: 2, is_active: true, sort: 0 }
const planForm = useForm(planBlank)
watch(editingPlan, (p) => p && planForm.reset(p.id ? { ...planBlank, ...p } : planBlank))
async function savePlan() {
  const req = editingPlan.value.id ? () => api.put(`/admin/plans/${editingPlan.value.id}`, planForm.data) : () => api.post('/admin/plans', planForm.data)
  await planForm.submit(req, { onSuccess: () => { editingPlan.value = null; loadPlans() } }).catch(() => {})
}

// Backups
const backingUp = ref(false)
async function runBackup() {
  backingUp.value = true
  try {
    ui.success((await api.post('/admin/backups')).data.message)
    loadBackups()
  } catch (e) {
    ui.error(e.message)
  } finally {
    backingUp.value = false
  }
}
const sizeLabel = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`)

const subColumns = [{ key: 'tenant', label: 'Organization' }, { key: 'plan', label: 'Plan' }, { key: 'ends', label: 'Paid until' }, { key: 'status', label: 'Status' }, { key: 'actions', label: '', align: 'right' }]
const planColumns = [{ key: 'name', label: 'Plan' }, { key: 'price', label: 'ETB / month', align: 'right' }, { key: 'trial', label: 'Free trial' }, { key: 'modules', label: 'Modules' }, { key: 'limits', label: 'Limits' }, { key: 'actions', label: '', align: 'right' }]
</script>

<template>
  <div>
    <PageHeader title="Plans & subscriptions" eyebrow="Platform" subtitle="SaaS billing for every pharmacy and hospital on MedLink, plus encrypted nightly database backups.">
      <button v-if="tab === 'plans'" class="btn btn-primary" @click="editingPlan = {}"><PlusIcon class="size-4" /> New plan</button>
      <button v-if="tab === 'backups'" class="btn btn-primary" :disabled="backingUp" @click="runBackup"><AppSpinner v-if="backingUp" /><CircleStackIcon v-else class="size-4" /> Back up now</button>
    </PageHeader>
    <PillTabs v-model="tab" :tabs="tabs" class="mb-4" />

    <div v-if="tab === 'subscriptions'" class="card overflow-hidden">
      <DataTable :columns="subColumns" :rows="subs.rows.value" :loading="subs.loading.value" empty-title="No subscriptions">
        <template #cell-tenant="{ row }"><p class="font-semibold">{{ row.tenant?.name }}</p><p class="text-xs text-slate-500 capitalize">{{ row.tenant?.type }} · {{ row.tenant?.city }}</p></template>
        <template #cell-plan="{ row }">{{ row.plan?.name }}<p class="text-xs text-slate-500">{{ money(row.plan?.price_monthly) }} / month</p></template>
        <template #cell-ends="{ row }">{{ row.ends_at ? date(row.ends_at) : '—' }}<p v-if="row.days_left !== null" class="text-xs" :class="row.days_left < 7 ? 'font-bold text-rose-600' : 'text-slate-500'">{{ row.days_left }} day(s)</p></template>
        <template #cell-status="{ row }"><StatusBadge :status="row.is_usable ? row.status : 'expired'" /></template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1">
            <button v-if="row.status !== 'cancelled'" class="btn btn-ghost btn-sm text-rose-600" @click="setStatus(row, 'cancelled')">Cancel</button>
            <button class="btn btn-primary btn-sm" @click="openPay(row)">Record payment</button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="subs.page.value" :meta="subs.meta.value" />
    </div>

    <div v-else-if="tab === 'requests'" id="plan-requests">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <select v-model="requestsFilter" class="input h-10 w-auto">
          <option value="open">Waiting & scheduled</option>
          <option value="pending">Waiting for a decision</option>
          <option value="scheduled">Scheduled downgrades</option>
          <option value="applied">Applied</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
          <option value="">All</option>
        </select>
        <p class="text-sm text-slate-500">Upgrades apply as soon as you approve. Downgrades wait until the paid period ends.</p>
      </div>
      <div class="card overflow-x-auto">
        <table class="w-full min-w-[52rem] text-sm">
          <thead class="bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
            <tr><th class="px-4 py-3">Organization</th><th class="px-4 py-3">Change</th><th class="px-4 py-3">Requested</th><th class="px-4 py-3">Status</th><th class="px-4 py-3"></th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="r in requests" :key="r.id" class="align-top">
              <td class="px-4 py-3"><p class="font-semibold">{{ r.tenant?.name }}</p><p class="text-xs text-slate-500 capitalize">{{ r.tenant?.type }} · {{ r.tenant?.city }}</p></td>
              <td class="px-4 py-3">
                <p><span class="chip mr-1 capitalize" :class="r.direction === 'upgrade' ? 'bg-brand-50 text-brand-700 ring-brand-300' : 'bg-slate-100 text-slate-700 ring-slate-300'">{{ r.direction }}</span>{{ r.from_plan?.name ?? 'No plan' }} → <b>{{ r.to_plan.name }}</b></p>
                <p class="mt-0.5 text-xs text-slate-500">{{ money(r.from_plan?.price_monthly ?? 0) }} → {{ money(r.to_plan.price_monthly) }} / month<template v-if="r.subscription?.ends_at"> · {{ r.subscription.status === 'trial' ? 'trial ends' : 'paid until' }} {{ date(r.subscription.ends_at) }}</template></p>
                <p v-if="r.note" class="mt-1 text-xs text-slate-700"><b>Their note:</b> {{ r.note }}</p>
                <p v-if="r.admin_note" class="mt-1 text-xs text-slate-700"><b>{{ r.status === 'rejected' ? 'Reason' : 'Your note' }}:</b> {{ r.admin_note }}</p>
              </td>
              <td class="px-4 py-3 text-slate-600">{{ date(r.created_at) }}<p v-if="r.requested_by" class="text-xs text-slate-500">{{ r.requested_by.name }}</p></td>
              <td class="px-4 py-3">
                <span class="chip capitalize" :class="REQUEST_STATUS[r.status]">{{ r.status === 'pending' ? 'waiting' : r.status }}</span>
                <p v-if="r.status === 'scheduled'" class="mt-1 text-xs text-slate-500">on {{ date(r.effective_at) }}</p>
                <p v-else-if="r.decided_by" class="mt-1 text-xs text-slate-500">by {{ r.decided_by }}</p>
              </td>
              <td class="px-4 py-3">
                <div v-if="r.status === 'pending'" class="flex justify-end gap-1">
                  <button class="btn btn-ghost btn-sm text-rose-600" :disabled="deciding === r.id" @click="decide(r, false)">Reject</button>
                  <button class="btn btn-primary btn-sm" :disabled="deciding === r.id" @click="decide(r, true)"><AppSpinner v-if="deciding === r.id" /> Approve</button>
                </div>
              </td>
            </tr>
            <tr v-if="!requests.length"><td colspan="5" class="px-4 py-10 text-center text-slate-500">No plan change requests here.</td></tr>
          </tbody>
        </table>
      </div>
      <AppPagination v-model="requestsPage" :meta="requestsMeta" />
    </div>

    <div v-else-if="tab === 'plans'" class="card overflow-hidden">
      <DataTable :columns="planColumns" :rows="plans" empty-title="No plans">
        <template #cell-name="{ row }"><p class="font-semibold" :class="!row.is_active && 'text-slate-400'">{{ row.name }}</p><p class="font-mono text-xs text-slate-500">{{ row.code }}</p></template>
        <template #cell-price="{ row }"><b>{{ money(row.price_monthly, { symbol: '' }) }}</b></template>
        <template #cell-trial="{ row }">
          <span v-if="trialLabel(row.trial_days)" class="chip bg-gold-100 text-amber-800 ring-gold-300">🎁 {{ trialLabel(row.trial_days) }}</span>
          <span v-else class="text-xs text-slate-400">No free trial</span>
        </template>
        <template #cell-modules="{ row }"><div class="flex flex-wrap gap-1"><span v-for="m in row.modules" :key="m" class="chip bg-slate-100 text-slate-700 ring-slate-500/15">{{ m }}</span></div></template>
        <template #cell-limits="{ row }"><span class="text-xs">{{ row.max_users }} staff · {{ row.max_branches }} location{{ row.max_branches === 1 ? '' : 's' }} · {{ row.max_stores }} stores</span></template>
        <template #cell-actions="{ row }"><button class="btn-icon size-8" @click="editingPlan = row"><PencilSquareIcon class="size-4" /></button></template>
      </DataTable>
    </div>

    <div v-else class="card overflow-hidden">
      <p class="border-b border-slate-100 px-5 py-3 text-sm text-slate-600">Backups are AES-encrypted with the application key, run every night at 02:00 and the newest ones are kept. Store a copy off-site.</p>
      <ul class="divide-y divide-slate-100">
        <li v-for="b in backups" :key="b.file" class="flex items-center justify-between px-5 py-3">
          <span><b class="font-mono text-sm">{{ b.file }}</b><span class="block text-xs text-slate-500">{{ dateTime(b.created_at) }} · {{ sizeLabel(b.size) }}</span></span>
          <button class="btn btn-ghost btn-sm" @click="download(`/admin/backups/${b.file}`).catch((e) => ui.error(e.message))"><ArrowDownTrayIcon class="size-4" /> Download</button>
        </li>
        <li v-if="!backups.length" class="px-5 py-8 text-center text-sm text-slate-500">No backups yet.</li>
      </ul>
    </div>

    <AppModal :open="!!paying" title="Record subscription payment" :subtitle="paying?.tenant?.name" @close="paying = null">
      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="Plan"><select v-model="pay.plan_id" class="input"><option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }}</option></select></FormField>
        <FormField label="Months"><input v-model.number="pay.months" type="number" min="1" max="24" class="input" /></FormField>
        <FormField label="Amount (ETB)"><input v-model.number="pay.amount" type="number" min="0" class="input" /></FormField>
        <FormField label="Method"><select v-model="pay.method" class="input"><option v-for="m in meta.paymentMethods" :key="m.value" :value="m.value">{{ m.label }}</option></select></FormField>
        <FormField label="Transaction reference" class="sm:col-span-2"><input v-model="pay.reference" class="input font-mono" /></FormField>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="paying = null">Cancel</button>
        <button class="btn btn-primary" :disabled="pay.busy" @click="savePay"><AppSpinner v-if="pay.busy" /> Save payment</button>
      </template>
    </AppModal>

    <AppModal :open="!!editingPlan" :title="editingPlan?.id ? 'Edit plan' : 'New plan'" size="lg" @close="editingPlan = null">
      <form id="plan-form" class="grid gap-4 sm:grid-cols-3" @submit.prevent="savePlan">
        <FormField label="Code" :error="planForm.errors.value.code" required><input v-model="planForm.data.code" class="input font-mono" required /></FormField>
        <FormField label="Name" :error="planForm.errors.value.name" required><input v-model="planForm.data.name" class="input" required /></FormField>
        <FormField label="ETB / month" :error="planForm.errors.value.price_monthly"><input v-model.number="planForm.data.price_monthly" type="number" min="0" class="input" /></FormField>
        <FormField label="Free trial (days)" :hint="trialLabel(planForm.data.trial_days) ?? 'No free trial'" :error="planForm.errors.value.trial_days"><input v-model.number="planForm.data.trial_days" type="number" min="0" max="365" class="input" /></FormField>
        <FormField label="Description" class="sm:col-span-3"><input v-model="planForm.data.description" class="input" /></FormField>
        <FormField label="Modules" class="sm:col-span-3" :error="planForm.errors.value.modules">
          <div class="flex flex-wrap gap-2"><label v-for="m in MODULES" :key="m" class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm capitalize"><input v-model="planForm.data.modules" type="checkbox" :value="m" class="rounded" /> {{ m }}</label></div>
        </FormField>
        <FormField label="Max staff accounts"><input v-model.number="planForm.data.max_users" type="number" min="1" class="input" /></FormField>
        <FormField label="Max locations" hint="Head office + branches"><input v-model.number="planForm.data.max_branches" type="number" min="1" class="input" /></FormField>
        <FormField label="Max stores"><input v-model.number="planForm.data.max_stores" type="number" min="1" class="input" /></FormField>
        <ToggleSwitch v-model="planForm.data.is_active" label="Offered to new customers" class="sm:col-span-3" />
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editingPlan = null">Cancel</button>
        <button form="plan-form" class="btn btn-primary" :disabled="planForm.processing.value"><AppSpinner v-if="planForm.processing.value" /> Save plan</button>
      </template>
    </AppModal>
  </div>
</template>
