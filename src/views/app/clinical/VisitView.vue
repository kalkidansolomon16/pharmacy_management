<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftIcon, BeakerIcon, CheckCircleIcon, DocumentPlusIcon, HeartIcon, PlayIcon, PlusIcon, XCircleIcon, XMarkIcon,
} from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, phone } from '@/lib/format'
import { useFormat } from '@/composables/useFormat'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import AppModal from '@/components/ui/AppModal.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import FormField from '@/components/ui/FormField.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import TriageModal from '@/components/clinical/TriageModal.vue'
import LabResultValue from '@/components/clinical/LabResultValue.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const { dateTime } = useFormat()

const visit = ref(null)
const loading = ref(true)
const triaging = ref(null)
const isDoctor = auth.can('consultations.manage')

const notes = useForm({ chief_complaint: '', history: '', examination: '', plan: '', diagnoses: [] })

async function load() {
  loading.value = true
  try {
    visit.value = (await api.get(`/visits/${route.params.id}`)).data.data
    notes.reset({
      chief_complaint: visit.value.chief_complaint ?? '', history: visit.value.history ?? '', examination: visit.value.examination ?? '',
      plan: visit.value.plan ?? '', diagnoses: [...(visit.value.diagnoses ?? [])],
    })
  } finally {
    loading.value = false
  }
}
onMounted(load)

const open = computed(() => visit.value && !['completed', 'cancelled'].includes(visit.value.status))
const canWrite = computed(() => isDoctor && open.value)

// ICD-10 diagnosis search (the Ethiopian OPD list; drives the HMIS/DHIS2 morbidity report)
const dxQuery = ref('')
const dxResults = ref([])
let dxTimer
watch(dxQuery, (q) => {
  clearTimeout(dxTimer)
  dxTimer = setTimeout(async () => (dxResults.value = q.length < 1 ? [] : (await api.get('/diagnoses', { params: { q } })).data.data.slice(0, 8)), 200)
})
function addDx(d) {
  if (!notes.data.diagnoses.some((x) => x.code === d.code)) notes.data.diagnoses.push({ code: d.code, name: d.name })
  dxQuery.value = ''
  dxResults.value = []
}

async function saveNotes() {
  await notes.submit(() => api.put(`/visits/${visit.value.id}/notes`, notes.data), { onSuccess: load }).catch(() => {})
}

async function act(action, body = {}, confirm = null) {
  if (confirm) {
    const ok = await ui.confirm(confirm)
    if (ok === false) return
    if (typeof ok === 'string') body.reason = ok
  }
  try {
    if (action === 'complete' && canWrite.value) await api.put(`/visits/${visit.value.id}/notes`, notes.data)
    const { data } = await api.post(`/visits/${visit.value.id}/${action}`, body)
    ui.success(data.message ?? 'Saved')
    await load()
  } catch (e) {
    ui.error(e.message)
  }
}

// Lab ordering
const labOpen = ref(false)
const labTests = ref([])
const labForm = useForm({ tests: [], priority: 'routine', clinical_notes: '' })
const labSearch = ref('')
async function openLab() {
  labOpen.value = true
  labForm.reset()
  if (!labTests.value.length) labTests.value = (await api.get('/lab-tests', { params: { per_page: 200 } })).data.data.filter((t) => t.is_active)
}
const filteredTests = computed(() => {
  const q = labSearch.value.toLowerCase()
  return labTests.value.filter((t) => !q || `${t.code} ${t.name} ${t.category}`.toLowerCase().includes(q))
})
const labTotal = computed(() => labTests.value.filter((t) => labForm.data.tests.includes(t.id)).reduce((s, t) => s + t.price, 0))
async function orderLab() {
  await labForm.submit(() => api.post('/lab-orders', { ...labForm.data, patient_id: visit.value.patient.id, visit_id: visit.value.id }), {
    onSuccess: () => {
      labOpen.value = false
      load()
    },
  }).catch(() => {})
}

const vitalRows = computed(() => {
  const v = visit.value?.vitals
  if (!v) return []
  return [
    ['Temperature', v.temperature, '°C'], ['Pulse', v.pulse, '/min'], ['Resp. rate', v.respiratory_rate, '/min'],
    ['Blood pressure', v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic ?? '?'}` : null, 'mmHg'], ['SpO₂', v.spo2, '%'],
    ['Weight', v.weight, 'kg'], ['Height', v.height, 'cm'], ['BMI', v.bmi, ''], ['MUAC', v.muac, 'cm'],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')
})
const prescribeLink = computed(() => ({
  name: 'app.prescriptions.new',
  query: { patient: visit.value?.patient?.id, visit: visit.value?.id, diagnosis: notes.data.diagnoses.map((d) => d.name).join('; ') || undefined },
}))
</script>

<template>
  <div>
    <button class="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800" @click="router.push({ name: 'app.queue' })"><ArrowLeftIcon class="size-4" /> Patient queue</button>

    <div v-if="loading && !visit" class="space-y-4"><div class="skeleton h-32" /><div class="skeleton h-96" /></div>

    <template v-else-if="visit">
      <!-- Patient banner -->
      <section class="card relative overflow-hidden">
        <div class="flag-ribbon h-1" />
        <div class="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
          <div class="flex min-w-0 flex-1 items-center gap-4">
            <UserAvatar :name="visit.patient?.full_name" size="lg" />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-extrabold text-slate-900">{{ visit.patient?.full_name }}</h1>
                <StatusBadge :status="visit.status" />
                <StatusBadge v-if="visit.priority === 'urgent'" status="urgent" />
              </div>
              <p class="text-sm text-slate-500">
                {{ visit.patient?.age ?? '?' }} yrs · {{ visit.patient?.gender }} · {{ visit.patient?.mrn || 'no card no.' }} · {{ phone(visit.patient?.phone) }}
                <template v-if="visit.patient?.blood_group"> · {{ visit.patient.blood_group }}</template>
              </p>
              <p class="text-xs text-slate-500">{{ visit.visit_number }} · queue #{{ visit.queue_number }} · <span class="capitalize">{{ visit.type.replace('_', ' ') }}</span> · checked in {{ dateTime(visit.checked_in_at) }}<template v-if="visit.doctor"> · {{ visit.doctor.name }}</template></p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <span v-if="visit.patient?.allergies" class="chip bg-rose-100 text-rose-700 ring-rose-600/20">⚠ Allergic: {{ visit.patient.allergies }}</span>
            <span v-if="visit.membership" class="chip" :class="visit.membership.is_valid ? 'bg-sky-50 text-sky-700 ring-sky-600/15' : 'bg-rose-50 text-rose-700 ring-rose-600/15'">
              {{ visit.membership.payer?.name }} · {{ visit.membership.member_number }} · co-pay {{ visit.membership.effective_copay_percent }}%
            </span>
            <span v-else class="chip bg-slate-100 text-slate-600 ring-slate-500/15">Cash patient</span>
          </div>
        </div>
        <div v-if="open" class="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <button v-if="auth.can('triage.record')" class="btn btn-secondary btn-sm" @click="triaging = visit"><HeartIcon class="size-4" /> Vital signs</button>
          <button v-if="isDoctor && visit.status !== 'in_consultation'" class="btn btn-secondary btn-sm" @click="act('start')"><PlayIcon class="size-4" /> Start consultation</button>
          <button v-if="isDoctor && auth.can('lab.order')" class="btn btn-secondary btn-sm" @click="openLab"><BeakerIcon class="size-4" /> Order lab tests</button>
          <RouterLink v-if="auth.can('prescriptions.create')" :to="prescribeLink" class="btn btn-secondary btn-sm"><DocumentPlusIcon class="size-4" /> Prescribe</RouterLink>
          <span class="flex-1" />
          <button v-if="auth.can('visits.manage') || isDoctor" class="btn btn-ghost btn-sm text-rose-600" @click="act('cancel', {}, { title: 'Cancel this visit?', message: 'The patient leaves the queue. Invoices stay for the cashier to void if needed.', confirmText: 'Cancel visit', danger: true, input: { label: 'Reason', required: false } })"><XCircleIcon class="size-4" /> Cancel visit</button>
          <button v-if="isDoctor" class="btn btn-primary btn-sm" @click="act('complete')"><CheckCircleIcon class="size-4" /> Complete visit</button>
        </div>
      </section>

      <div class="mt-6 grid gap-6 xl:grid-cols-[1fr_24rem]">
        <!-- Consultation -->
        <section class="space-y-6">
          <div class="card card-pad">
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-slate-900">Vital signs</h2>
              <span v-if="visit.triaged_at" class="text-xs text-slate-500">{{ dateTime(visit.triaged_at) }}</span>
            </div>
            <div v-if="vitalRows.length" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div v-for="[label, value, unit] in vitalRows" :key="label" class="rounded-xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">{{ label }}</p>
                <p class="text-lg font-extrabold text-slate-900">{{ value }} <span class="text-xs font-semibold text-slate-400">{{ unit }}</span></p>
              </div>
            </div>
            <p v-else class="mt-3 text-sm text-amber-700">Not triaged yet.</p>
            <div v-if="visit.vitals?.alerts?.length" class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="a in visit.vitals.alerts" :key="a" class="chip bg-rose-50 text-rose-700 ring-rose-600/15">⚠ {{ a }}</span>
            </div>
          </div>

          <div class="card card-pad">
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-slate-900">Consultation</h2>
              <span class="text-xs text-slate-400">🔒 Encrypted - visible to clinicians only</span>
            </div>
            <form class="mt-4 space-y-4" @submit.prevent="saveNotes">
              <FormField label="Chief complaint"><input v-model="notes.data.chief_complaint" class="input" :disabled="!canWrite" /></FormField>
              <template v-if="visit.history !== undefined">
                <FormField label="History"><textarea v-model="notes.data.history" rows="3" class="input" :disabled="!canWrite" placeholder="HPI, past history, medications…" /></FormField>
                <FormField label="Examination"><textarea v-model="notes.data.examination" rows="3" class="input" :disabled="!canWrite" placeholder="General appearance, systems…" /></FormField>
              </template>
              <FormField label="Diagnosis (ICD-10)" :error="notes.errors.value.diagnoses" hint="Required to close the visit - feeds the monthly HMIS / DHIS2 report">
                <div class="flex flex-wrap gap-1.5">
                  <span v-for="(d, i) in notes.data.diagnoses" :key="d.code" class="chip bg-brand-50 text-brand-800 ring-brand-600/15">
                    <b class="font-mono">{{ d.code }}</b> {{ d.name }}
                    <button v-if="canWrite" type="button" class="ml-0.5" @click="notes.data.diagnoses.splice(i, 1)"><XMarkIcon class="size-3.5" /></button>
                  </span>
                </div>
                <div v-if="canWrite" class="relative mt-2">
                  <input v-model="dxQuery" class="input" placeholder="Search e.g. malaria, B54, typhoid, hypertension" />
                  <ul v-if="dxResults.length" class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    <li v-for="d in dxResults" :key="d.code"><button type="button" class="flex w-full gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50" @click="addDx(d)"><b class="w-14 font-mono">{{ d.code }}</b>{{ d.name }}</button></li>
                  </ul>
                </div>
              </FormField>
              <FormField v-if="visit.plan !== undefined" label="Plan"><textarea v-model="notes.data.plan" rows="3" class="input" :disabled="!canWrite" placeholder="Treatment, advice, follow-up date…" /></FormField>
              <div v-if="canWrite" class="flex justify-end">
                <button class="btn btn-primary" :disabled="notes.processing.value"><AppSpinner v-if="notes.processing.value" /> Save notes</button>
              </div>
            </form>
          </div>
        </section>

        <!-- Orders & billing -->
        <aside class="space-y-6">
          <div class="card card-pad">
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-slate-900">Laboratory</h2>
              <button v-if="open && isDoctor && auth.can('lab.order')" class="btn btn-ghost btn-sm" @click="openLab"><PlusIcon class="size-4" /> Order</button>
            </div>
            <div v-for="o in visit.lab_orders" :key="o.id" class="mt-4 rounded-xl border border-slate-200">
              <div class="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <span class="font-mono text-xs font-bold">{{ o.order_number }}</span>
                <StatusBadge :status="o.status" />
              </div>
              <ul class="divide-y divide-slate-100 text-sm">
                <li v-for="i in o.items" :key="i.id" class="flex items-center justify-between gap-2 px-3 py-2">
                  <span class="min-w-0"><span class="block truncate font-semibold">{{ i.test?.name }}</span><span class="text-xs text-slate-400">{{ i.reference }}</span></span>
                  <LabResultValue :item="i" />
                </li>
              </ul>
            </div>
            <p v-if="!visit.lab_orders?.length" class="mt-3 text-sm text-slate-500">No tests ordered.</p>
          </div>

          <div class="card card-pad">
            <h2 class="font-bold text-slate-900">Prescriptions</h2>
            <RouterLink v-for="p in visit.prescriptions" :key="p.id" :to="{ name: 'app.prescription', params: { id: p.id } }" class="mt-3 block rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50">
              <span class="flex items-center justify-between"><b class="font-mono text-sm">{{ p.reference_code }}</b><StatusBadge :status="p.status" /></span>
              <span class="block truncate text-xs text-slate-500">{{ p.items.map((i) => i.medicine?.display_name).join(', ') }}</span>
            </RouterLink>
            <p v-if="!visit.prescriptions?.length" class="mt-3 text-sm text-slate-500">None yet.</p>
          </div>

          <div v-if="auth.can('billing.view')" class="card card-pad">
            <h2 class="font-bold text-slate-900">Bills</h2>
            <ul class="mt-3 space-y-2 text-sm">
              <li v-for="inv in visit.invoices" :key="inv.id" class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span><b class="font-mono text-xs">{{ inv.invoice_number }}</b><span class="block text-xs text-slate-500">{{ money(inv.total) }}<template v-if="inv.payer_share"> · insurer {{ money(inv.payer_share) }}</template></span></span>
                <span class="text-right">
                  <StatusBadge :status="inv.status" />
                  <span v-if="inv.patient_balance > 0" class="block text-xs font-bold text-rose-600">due {{ money(inv.patient_balance) }}</span>
                </span>
              </li>
            </ul>
            <p v-if="!visit.invoices?.length" class="text-sm text-slate-500">No bills.</p>
            <RouterLink v-if="auth.can('billing.collect')" :to="{ name: 'app.cashier', query: { search: visit.patient?.full_name } }" class="btn btn-secondary btn-sm mt-3 w-full">Open at cashier</RouterLink>
          </div>
        </aside>
      </div>
    </template>

    <TriageModal :visit="triaging" @close="triaging = null" @saved="triaging = null; load()" />

    <AppModal :open="labOpen" title="Order laboratory tests" :subtitle="visit?.patient?.full_name" size="lg" @close="labOpen = false">
      <input v-model="labSearch" class="input mb-3" placeholder="Filter tests…" />
      <div class="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 scrollbar-thin">
        <label v-for="t in filteredTests" :key="t.id" class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition" :class="labForm.data.tests.includes(t.id) ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'">
          <input v-model="labForm.data.tests" type="checkbox" :value="t.id" class="mt-1 rounded" />
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold">{{ t.name }}</span>
            <span class="text-xs text-slate-500"><span class="font-mono">{{ t.code }}</span> · {{ t.specimen || t.category }} · {{ money(t.price) }}</span>
          </span>
        </label>
      </div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <FormField label="Priority">
          <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            <button v-for="p in ['routine', 'urgent']" :key="p" type="button" class="rounded-lg py-1.5 capitalize" :class="labForm.data.priority === p ? (p === 'urgent' ? 'bg-rose-600 text-white' : 'bg-white shadow-sm') : 'text-slate-500'" @click="labForm.data.priority = p">{{ p }}</button>
          </div>
        </FormField>
        <FormField label="Clinical notes for the lab"><input v-model="labForm.data.clinical_notes" class="input" placeholder="e.g. Fever 3 days, ? malaria" /></FormField>
      </div>
      <p v-if="labForm.errors.value.tests" class="field-error">{{ labForm.errors.value.tests }}</p>
      <template #footer>
        <span class="mr-auto self-center text-sm text-slate-500">{{ labForm.data.tests.length }} test(s) · <b class="text-slate-900">{{ money(labTotal) }}</b></span>
        <button class="btn btn-secondary" @click="labOpen = false">Cancel</button>
        <button class="btn btn-primary" :disabled="!labForm.data.tests.length || labForm.processing.value" @click="orderLab"><AppSpinner v-if="labForm.processing.value" /> Send to lab</button>
      </template>
    </AppModal>
  </div>
</template>
