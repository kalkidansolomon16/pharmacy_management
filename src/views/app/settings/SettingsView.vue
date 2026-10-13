<script setup>
import { computed, onMounted, ref } from 'vue'
import { ClipboardDocumentIcon, KeyIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { phone } from '@/lib/format'
import { useFormat } from '@/composables/useFormat'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import FormField from '@/components/ui/FormField.vue'
import AppModal from '@/components/ui/AppModal.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const meta = useMetaStore()
const ui = useUiStore()
const { dateTime, relative } = useFormat()
meta.load()

const MODULES = {
  pharmacy: ['Pharmacy', 'POS, FEFO inventory, purchasing, stores & transfers, controlled register'],
  clinical: ['Clinic / OPD', 'Reception queue, triage, consultation notes, ICD-10 diagnoses, e-prescriptions'],
  lab: ['Laboratory', 'Lab orders, worklist, results with reference ranges and critical alerts'],
  billing: ['Billing', 'Cashier, invoices, VAT/TOT, Ministry of Revenue e-invoicing'],
  insurance: ['Insurance & credit', 'CBHI, private insurers, corporate credit, pre-authorization, monthly claims'],
}
const tab = ref('modules')
const tabs = computed(() => [
  { value: 'modules', label: 'Modules' },
  { value: 'tax', label: 'Tax & e-invoicing' },
  { value: 'workflow', label: 'Workflow' },
  ...(auth.tenantType === 'hospital' ? [{ value: 'appointments', label: 'Online appointments' }] : []),
  ...(auth.can('owner.dashboard') ? [{ value: 'branches', label: 'Branches' }] : []),
  ...(auth.can('integrations.manage') ? [{ value: 'integrations', label: 'Integrations' }] : []),
])

const settings = ref(null)
const saving = ref(false)
onMounted(async () => {
  settings.value = (await api.get('/organization/settings')).data.data
  if (auth.can('owner.dashboard')) loadBranches()
  if (auth.can('integrations.manage')) loadTokens()
})

async function save(patch) {
  saving.value = true
  try {
    const { data } = await api.put('/organization/settings', patch)
    settings.value = data.data
    ui.success('Settings saved.')
    await auth.fetchMe() // modules drive the sidebar
  } catch (e) {
    ui.error(e.message)
  } finally {
    saving.value = false
  }
}
function toggleModule(m, on) {
  const next = new Set(settings.value.modules)
  on ? next.add(m) : next.delete(m)
  save({ modules: [...next] })
}
const setSetting = (key, value) => save({ settings: { [key]: value } })

// Online appointments: days of the week (ISO: Monday = 1)
const WEEKDAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']]
function toggleDay(day) {
  const days = new Set(settings.value.settings.appointment_days ?? [])
  days.has(day) ? days.delete(day) : days.add(day)
  if (!days.size) return ui.error('Keep at least one day open, or switch online appointments off.')
  setSetting('appointment_days', [...days].sort())
}
const dailyCapacity = computed(() => {
  const s = settings.value?.settings
  if (!s?.appointment_open || !s?.appointment_close) return 0
  const [oh, om] = s.appointment_open.split(':').map(Number)
  const [ch, cm] = s.appointment_close.split(':').map(Number)
  return Math.max(0, Math.floor((ch * 60 + cm - oh * 60 - om) / s.appointment_slot_minutes)) * s.appointments_per_slot
})

// Branches
const branches = ref([])
const loadBranches = async () => (branches.value = (await api.get('/organization/branches')).data.data)
const addingBranch = ref(false)
const branch = useForm({ name: '', license_number: '', phone: '', region: 'Addis Ababa', city: 'Addis Ababa', sub_city: '', woreda: '', address_line: '', admin: { name: '', email: '', phone: '', password: '' } })
async function saveBranch() {
  await branch.submit(() => api.post('/organization/branches', branch.data), { onSuccess: () => { addingBranch.value = false; loadBranches() } }).catch(() => {})
}

// Integration tokens (FHIR / DHIS2 bridges)
const tokens = ref([])
const newToken = ref(null)
const tokenName = ref('')
const loadTokens = async () => (tokens.value = (await api.get('/integrations/tokens')).data.data)
async function createToken() {
  try {
    newToken.value = (await api.post('/integrations/tokens', { name: tokenName.value })).data.data
    tokenName.value = ''
    loadTokens()
  } catch (e) {
    ui.error(e.message)
  }
}
async function revoke(t) {
  if (!(await ui.confirm({ title: `Revoke "${t.name}"?`, message: 'Systems using this token lose access immediately.', danger: true, confirmText: 'Revoke' }))) return
  await api.delete(`/integrations/tokens/${t.id}`)
  loadTokens()
}
const copy = (text) => navigator.clipboard?.writeText(text).then(() => ui.success('Copied'))
</script>

<template>
  <div>
    <PageHeader title="Settings" eyebrow="Organization" subtitle="Switch modules on as you grow, set your tax regime and how patients move through the facility." />
    <PillTabs v-model="tab" :tabs="tabs" class="mb-5" />
    <div v-if="!settings" class="skeleton h-80 rounded-2xl" />

    <template v-else>
      <section v-if="tab === 'modules'" class="grid gap-4 md:grid-cols-2">
        <div v-for="(info, m) in MODULES" :key="m" class="card card-pad" :class="!settings.available_modules.includes(m) && 'opacity-60'">
          <ToggleSwitch
            :model-value="settings.modules.includes(m)"
            :label="info[0]"
            :description="info[1]"
            @update:model-value="(on) => settings.available_modules.includes(m) ? toggleModule(m, on) : ui.info('Not included in your plan - upgrade under Subscription.')"
          />
          <p v-if="!settings.available_modules.includes(m)" class="mt-2 text-xs font-semibold text-amber-700">Not in your current plan</p>
        </div>
      </section>

      <section v-else-if="tab === 'tax'" class="card card-pad max-w-2xl space-y-5">
        <FormField label="Tax regime" hint="Medicines and most health services are VAT-exempt; supplements and cosmetics are taxable.">
          <div class="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            <button v-for="r in [{ v: 'exempt', l: 'Not registered' }, { v: 'vat', l: 'VAT 15%' }, { v: 'tot', l: 'TOT 2% / 10%' }]" :key="r.v" class="rounded-lg py-2" :class="settings.tax_regime === r.v ? 'bg-white shadow-sm' : 'text-slate-500'" @click="save({ tax_regime: r.v })">{{ r.l }}</button>
          </div>
        </FormField>
        <FormField label="VAT registration number"><input :value="settings.vat_number" class="input font-mono" @change="save({ vat_number: $event.target.value || null })" /></FormField>
        <p class="text-sm text-slate-600">Seller TIN: <b class="font-mono">{{ settings.tin_number || 'not set - add it under Organization' }}</b></p>
        <ToggleSwitch :model-value="settings.settings.einvoice_enabled" label="Register invoices with the Ministry of Revenue (e-invoicing)" description="Each invoice gets an IRN and QR code; it is sent to EIRS and retried automatically if the connection is down." @update:model-value="(v) => setSetting('einvoice_enabled', v)" />
        <p class="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">Until your MoR accreditation credentials are configured on the server, invoices are registered in a local sandbox that follows the same IRN / RRN / QR flow.</p>
      </section>

      <section v-else-if="tab === 'workflow'" class="card card-pad max-w-2xl space-y-5">
        <ToggleSwitch :model-value="settings.settings.payment_before_service" label="Payment before service" description="The lab and pharmacy wait until the patient has paid at the cashier (insured patients are not blocked)." @update:model-value="(v) => setSetting('payment_before_service', v)" />
        <ToggleSwitch :model-value="settings.settings.registration_fee_on_check_in" label="Bill card & consultation fees at check-in" description="Uses the REG / CONS-* codes in the service price list." @update:model-value="(v) => setSetting('registration_fee_on_check_in', v)" />
        <ToggleSwitch v-if="auth.hasModule('pharmacy')" :model-value="settings.settings.pay_at_cashier" label="Pay at the cashier (pharmacy counter)" description="The pharmacist sends each counter sale to the cashier; the cashier takes the money and only then is the medicine taken from stock and handed over. Sales made while offline are still paid at the counter." @update:model-value="(v) => setSetting('pay_at_cashier', v)" />
        <ToggleSwitch v-if="auth.hasModule('clinical')" :model-value="settings.settings.card_fee_before_consultation" label="Card fee before consultation" description="The doctor can start a consultation only after the card / consultation fee is paid at the cashier. Emergencies are never blocked; insured patients only need to pay their co-pay share." @update:model-value="(v) => setSetting('card_fee_before_consultation', v)" />
        <ToggleSwitch :model-value="settings.settings.four_eyes_lab_verification" label="Four-eyes lab verification" description="A second lab professional must verify results before they are released." @update:model-value="(v) => setSetting('four_eyes_lab_verification', v)" />
        <div class="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <FormField label="DHIS2 organisation unit id" hint="From your woreda / zonal health office"><input :value="settings.settings.dhis2_org_unit" class="input font-mono" @change="setSetting('dhis2_org_unit', $event.target.value || null)" /></FormField>
          <FormField label="DHIS2 data set id"><input :value="settings.settings.dhis2_dataset" class="input font-mono" @change="setSetting('dhis2_dataset', $event.target.value || null)" /></FormField>
        </div>
        <p v-if="saving" class="text-xs text-slate-500">Saving…</p>
      </section>

      <section v-else-if="tab === 'appointments'" class="card card-pad max-w-2xl space-y-5">
        <ToggleSwitch
          :model-value="settings.settings.appointments_enabled"
          label="Patients can book appointments online"
          description="From the MedLink website and mobile app. They see how busy each time is and book a free one; you check them in under Appointments."
          @update:model-value="(v) => setSetting('appointments_enabled', v)"
        />
        <template v-if="settings.settings.appointments_enabled">
          <div>
            <p class="field-label">Days open for appointments</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="[d, label] in WEEKDAYS"
                :key="d"
                type="button"
                class="rounded-xl px-3 py-2 text-sm font-bold ring-1"
                :class="(settings.settings.appointment_days ?? []).includes(d) ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-500 ring-slate-200'"
                @click="toggleDay(d)"
              >{{ label }}</button>
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <FormField label="First appointment"><input :value="settings.settings.appointment_open" type="time" step="900" class="input" @change="setSetting('appointment_open', $event.target.value)" /></FormField>
            <FormField label="Appointments end at"><input :value="settings.settings.appointment_close" type="time" step="900" class="input" @change="setSetting('appointment_close', $event.target.value)" /></FormField>
            <FormField label="Length of each time slot">
              <select :value="settings.settings.appointment_slot_minutes" class="input" @change="setSetting('appointment_slot_minutes', Number($event.target.value))">
                <option v-for="m in [15, 20, 30, 45, 60]" :key="m" :value="m">{{ m }} minutes</option>
              </select>
            </FormField>
            <FormField label="Patients per slot" hint="How many patients your doctors can see in one slot">
              <input :value="settings.settings.appointments_per_slot" type="number" min="1" max="50" class="input" @change="setSetting('appointments_per_slot', Number($event.target.value))" />
            </FormField>
          </div>
          <p class="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
            Up to <b>{{ dailyCapacity }}</b> online appointments a day. Walk-in patients still come through the normal queue -
            leave room for them by not booking every place online.
          </p>
        </template>
        <p v-if="saving" class="text-xs text-slate-500">Saving…</p>
      </section>

      <section v-else-if="tab === 'branches'" class="space-y-4">
        <div class="flex justify-end"><button class="btn btn-primary" @click="addingBranch = true"><PlusIcon class="size-4" /> Request a branch</button></div>
        <div class="card overflow-hidden">
          <ul class="divide-y divide-slate-100">
            <li v-for="b in branches" :key="b.id" class="flex items-center justify-between px-5 py-3">
              <span><b>{{ b.name }}</b><span class="block text-xs text-slate-500">{{ [b.sub_city, b.city].filter(Boolean).join(', ') }} · {{ phone(b.phone) }} · {{ b.users_count }} users</span></span>
              <StatusBadge :status="b.status" />
            </li>
            <li v-if="!branches.length" class="px-5 py-8 text-center text-sm text-slate-500">No branches yet. New branches are verified by MedLink before going live.</li>
          </ul>
        </div>
      </section>

      <section v-else-if="tab === 'integrations'" class="space-y-4">
        <div class="card card-pad">
          <h2 class="font-bold text-slate-900">HL7 FHIR R4 API</h2>
          <p class="mt-1 text-sm text-slate-600">Read-only access to Patient, Encounter, Observation (lab), MedicationRequest and Medication for other hospital systems, the national HIE or a DHIS2 bridge. Tokens can only read FHIR - nothing else.</p>
          <form class="mt-4 flex gap-2" @submit.prevent="createToken">
            <input v-model="tokenName" class="input flex-1" placeholder="Token name, e.g. Regional HIE bridge" required />
            <button class="btn btn-primary"><KeyIcon class="size-4" /> Create token</button>
          </form>
          <div v-if="newToken" class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <p class="font-bold text-amber-900">Copy this token now - it is shown only once.</p>
            <p class="mt-2 flex items-center gap-2 break-all font-mono text-xs">{{ newToken.token }} <button class="btn-icon size-7 shrink-0" @click="copy(newToken.token)"><ClipboardDocumentIcon class="size-4" /></button></p>
            <p class="mt-2 text-xs">Base URL: <span class="font-mono">{{ newToken.base_url }}</span> · send as <span class="font-mono">Authorization: Bearer …</span></p>
          </div>
        </div>
        <div class="card overflow-hidden">
          <ul class="divide-y divide-slate-100">
            <li v-for="t in tokens" :key="t.id" class="flex items-center justify-between px-5 py-3">
              <span><b>{{ t.name }}</b><span class="block text-xs text-slate-500">{{ (t.abilities || []).join(', ') }} · created {{ dateTime(t.created_at) }} · {{ t.last_used_at ? 'used ' + relative(t.last_used_at) : 'never used' }}</span></span>
              <button class="btn btn-ghost btn-sm text-rose-600" @click="revoke(t)"><TrashIcon class="size-4" /> Revoke</button>
            </li>
            <li v-if="!tokens.length" class="px-5 py-8 text-center text-sm text-slate-500">No integration tokens.</li>
          </ul>
        </div>
      </section>
    </template>

    <AppModal :open="addingBranch" title="Request a new branch" subtitle="It shares your catalogue setup and appears in the owner overview once approved." size="lg" @close="addingBranch = false">
      <form id="branch-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveBranch">
        <FormField label="Branch name" :error="branch.errors.value.name" class="sm:col-span-2" required><input v-model="branch.data.name" class="input" required /></FormField>
        <FormField label="Licence number" :error="branch.errors.value.license_number" required><input v-model="branch.data.license_number" class="input" required /></FormField>
        <FormField label="Phone" :error="branch.errors.value.phone" required><input v-model="branch.data.phone" class="input" required /></FormField>
        <FormField label="Region"><select v-model="branch.data.region" class="input"><option v-for="r in meta.regions" :key="r.name">{{ r.name }}</option></select></FormField>
        <FormField label="City"><select v-model="branch.data.city" class="input"><option v-for="c in meta.citiesFor(branch.data.region)" :key="c">{{ c }}</option></select></FormField>
        <FormField label="Sub-city"><input v-model="branch.data.sub_city" class="input" /></FormField>
        <FormField label="Address"><input v-model="branch.data.address_line" class="input" /></FormField>
        <p class="text-sm font-bold text-slate-900 sm:col-span-2">Branch manager account</p>
        <FormField label="Name" :error="branch.errors.value['admin.name']"><input v-model="branch.data.admin.name" class="input" /></FormField>
        <FormField label="Email" :error="branch.errors.value['admin.email']"><input v-model="branch.data.admin.email" type="email" class="input" /></FormField>
        <FormField label="Phone" :error="branch.errors.value['admin.phone']"><input v-model="branch.data.admin.phone" class="input" /></FormField>
        <FormField label="Password" :error="branch.errors.value['admin.password']"><input v-model="branch.data.admin.password" type="password" class="input" autocomplete="new-password" /></FormField>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="addingBranch = false">Cancel</button>
        <button form="branch-form" class="btn btn-primary" :disabled="branch.processing.value"><AppSpinner v-if="branch.processing.value" /> Submit for approval</button>
      </template>
    </AppModal>
  </div>
</template>
