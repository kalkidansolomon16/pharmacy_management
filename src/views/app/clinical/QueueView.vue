<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowPathIcon, HeartIcon, PlayIcon, UserPlusIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money } from '@/lib/format'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import PatientPicker from '@/components/clinical/PatientPicker.vue'
import TriageModal from '@/components/clinical/TriageModal.vue'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const { rows, meta, extra, loading, filters, page, reload } = useList('/visits', { status: 'open', search: '', mine: false, scope: 'today' }, { perPage: 30 })
const counts = computed(() => extra.value.counts ?? {})
const tabs = computed(() => [
  { value: 'open', label: 'In clinic' },
  { value: 'waiting', label: 'Waiting', count: counts.value.waiting ?? 0 },
  { value: 'in_consultation', label: 'With doctor', count: counts.value.in_consultation ?? 0 },
  { value: 'awaiting_lab', label: 'At the lab', count: counts.value.awaiting_lab ?? 0 },
  { value: 'awaiting_review', label: 'Results back', count: counts.value.awaiting_review ?? 0 },
  { value: 'completed', label: 'Seen today', count: counts.value.completed ?? 0 },
])

// Auto-refresh the board every 30 seconds (queue screens stay open all day)
const timer = setInterval(reload, 30000)
onBeforeUnmount(() => clearInterval(timer))

const isDoctor = auth.can('consultations.manage')
const types = [
  { value: 'opd', label: 'OPD' }, { value: 'emergency', label: 'Emergency' }, { value: 'follow_up', label: 'Follow-up' },
  { value: 'antenatal', label: 'Antenatal (ANC)' }, { value: 'other', label: 'Other' },
]

// Check-in
const checkIn = ref(false)
const patient = ref(null)
const doctors = ref([])
const memberships = ref([])
const form = useForm({ type: 'opd', doctor_id: '', membership_id: '', chief_complaint: '', department: '' })

watch(checkIn, async (open) => {
  if (!open) return
  form.reset()
  patient.value = null
  doctors.value = (await api.get('/visits/doctors')).data.data
})
watch(patient, async (p) => {
  memberships.value = []
  form.data.membership_id = ''
  if (p && auth.can('insurance.view') && auth.hasModule('insurance')) {
    memberships.value = (await api.get('/memberships', { params: { patient_id: p.id } })).data.data
    const valid = memberships.value.find((m) => m.is_valid)
    if (valid) form.data.membership_id = valid.id
  }
})

async function submitCheckIn() {
  await form.submit(() => api.post('/visits', { ...form.data, patient_id: patient.value?.id, doctor_id: form.data.doctor_id || null, membership_id: form.data.membership_id || null }), {
    onSuccess: () => {
      checkIn.value = false
      reload()
    },
  }).catch(() => {})
}

// Triage & consultation
const triaging = ref(null)
async function startConsultation(v) {
  try {
    await api.post(`/visits/${v.id}/start`)
    router.push({ name: 'app.visit', params: { id: v.id } })
  } catch (e) {
    ui.error(e.message)
  }
}

const vitalsSummary = (v) => {
  const x = v.vitals
  if (!x) return null
  return [x.temperature && `${x.temperature}°C`, x.bp_systolic && `BP ${x.bp_systolic}/${x.bp_diastolic ?? '?'}`, x.pulse && `P ${x.pulse}`, x.spo2 && `SpO₂ ${x.spo2}%`].filter(Boolean).join(' · ')
}
const waitLabel = (m) => (m == null ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`)

const columns = [
  { key: 'queue', label: '#', class: 'w-12' },
  { key: 'patient', label: 'Patient' },
  { key: 'visit', label: 'Visit' },
  { key: 'vitals', label: 'Triage' },
  { key: 'doctor', label: 'Doctor' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' },
]
</script>

<template>
  <div>
    <PageHeader title="Patient queue" eyebrow="Reception · Triage · OPD" subtitle="Everyone in the clinic today, urgent cases first. The board refreshes itself every 30 seconds.">
      <button class="btn btn-secondary" @click="reload"><ArrowPathIcon class="size-4" :class="loading && 'animate-spin'" /> Refresh</button>
      <button v-if="auth.can('visits.manage')" class="btn btn-primary" @click="checkIn = true"><UserPlusIcon class="size-4" /> Check in patient</button>
    </PageHeader>

    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <PillTabs v-model="filters.status" :tabs="tabs" />
      <div class="flex items-center gap-3">
        <span v-if="extra.only_mine" class="text-sm font-semibold text-slate-600" title="Patients assigned to other doctors are on their own lists">Your patients + not yet assigned</span>
        <label v-else-if="isDoctor" class="flex items-center gap-2 text-sm font-semibold text-slate-600"><input v-model="filters.mine" type="checkbox" class="rounded" /> My patients</label>
        <SearchInput v-model="filters.search" placeholder="Name, card no. or visit no." class="w-64" />
      </div>
    </div>

    <div class="card overflow-hidden">
      <DataTable :columns="columns" :rows="rows" :loading="loading" clickable empty-title="Nobody in the queue" empty-text="Checked-in patients appear here." @row-click="(v) => router.push({ name: 'app.visit', params: { id: v.id } })">
        <template #cell-queue="{ row }">
          <span class="grid size-9 place-items-center rounded-xl text-sm font-extrabold" :class="row.priority === 'urgent' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'">{{ row.queue_number }}</span>
        </template>
        <template #cell-patient="{ row }">
          <div class="flex items-center gap-3">
            <UserAvatar :name="row.patient?.full_name" size="sm" />
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-900">{{ row.patient?.full_name }}</p>
              <p class="text-xs text-slate-500">{{ row.patient?.mrn || '—' }} · {{ row.patient?.age ?? '?' }}y {{ row.patient?.gender === 'female' ? 'F' : 'M' }}</p>
              <p v-if="row.patient?.allergies" class="text-xs font-bold text-rose-600">⚠ {{ row.patient.allergies }}</p>
            </div>
          </div>
        </template>
        <template #cell-visit="{ row }">
          <p class="font-mono text-xs font-bold">{{ row.visit_number }}</p>
          <p class="text-xs text-slate-500 capitalize">{{ row.type.replace('_', ' ') }}<template v-if="row.membership"> · {{ row.membership.payer?.name }}</template></p>
          <p v-if="row.chief_complaint" class="max-w-52 truncate text-xs text-slate-600">“{{ row.chief_complaint }}”</p>
        </template>
        <template #cell-vitals="{ row }">
          <p v-if="vitalsSummary(row)" class="text-xs text-slate-700">{{ vitalsSummary(row) }}</p>
          <p v-else class="text-xs text-amber-600">Not yet triaged</p>
          <div v-if="row.vitals?.alerts?.length" class="mt-1 flex flex-wrap gap-1"><span v-for="a in row.vitals.alerts" :key="a" class="rounded bg-rose-50 px-1.5 text-[0.68rem] font-bold text-rose-700">{{ a }}</span></div>
        </template>
        <template #cell-doctor="{ row }">
          <span class="text-sm">{{ row.doctor?.name ?? 'Any doctor' }}</span>
          <p v-if="row.waiting_minutes != null && row.status === 'waiting'" class="text-xs" :class="row.waiting_minutes > 60 ? 'font-bold text-rose-600' : 'text-slate-500'">waiting {{ waitLabel(row.waiting_minutes) }}</p>
        </template>
        <template #cell-status="{ row }">
          <div class="flex flex-col items-start gap-1">
            <StatusBadge :status="row.status" />
            <StatusBadge v-if="row.priority === 'urgent'" status="urgent" />
            <span v-if="row.fees_due" class="chip bg-rose-50 text-rose-700 ring-rose-300" :title="`Pending at the cashier: ${row.fees_due.invoices.join(', ')}`">Card fee unpaid · {{ money(row.fees_due.amount) }}</span>
          </div>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1" @click.stop>
            <button v-if="auth.can('triage.record') && ['waiting', 'in_consultation'].includes(row.status)" class="btn btn-ghost btn-sm" @click="triaging = row"><HeartIcon class="size-4" /> Vitals</button>
            <button v-if="isDoctor && ['waiting', 'awaiting_review'].includes(row.status)" class="btn btn-primary btn-sm" @click="startConsultation(row)"><PlayIcon class="size-4" /> See</button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="page" :meta="meta" />
    </div>

    <TriageModal :visit="triaging" @close="triaging = null" @saved="triaging = null; reload()" />

    <AppModal :open="checkIn" title="Check in patient" subtitle="Card and consultation fees are billed automatically from the price list." size="lg" @close="checkIn = false">
      <form id="checkin-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="submitCheckIn">
        <FormField label="Patient" class="sm:col-span-2" :error="form.errors.value.patient_id" required>
          <PatientPicker v-model="patient">
            <template #not-found><RouterLink :to="{ name: 'app.patients' }" class="font-semibold text-brand-700">Register a new patient →</RouterLink></template>
          </PatientPicker>
        </FormField>
        <FormField label="Visit type" :error="form.errors.value.type">
          <select v-model="form.data.type" class="input"><option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option></select>
        </FormField>
        <FormField label="Doctor" hint="Leave empty for the next available doctor">
          <select v-model="form.data.doctor_id" class="input">
            <option value="">Next available</option>
            <option v-for="d in doctors" :key="d.id" :value="d.id">{{ d.name }} ({{ d.waiting }} waiting)</option>
          </select>
        </FormField>
        <FormField v-if="memberships.length" label="Bill to" class="sm:col-span-2" :error="form.errors.value.membership_id">
          <select v-model="form.data.membership_id" class="input">
            <option value="">Cash (patient pays)</option>
            <option v-for="m in memberships" :key="m.id" :value="m.id" :disabled="!m.is_valid">
              {{ m.payer?.name }} · {{ m.member_number }} {{ m.is_valid ? `(co-pay ${m.effective_copay_percent}%)` : '- NOT VALID' }}
            </option>
          </select>
        </FormField>
        <FormField label="Chief complaint" class="sm:col-span-2"><input v-model="form.data.chief_complaint" class="input" placeholder="e.g. Fever and headache for 3 days" /></FormField>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="checkIn = false">Cancel</button>
        <button form="checkin-form" class="btn btn-primary" :disabled="!patient || form.processing.value"><AppSpinner v-if="form.processing.value" /> Check in</button>
      </template>
    </AppModal>
  </div>
</template>
