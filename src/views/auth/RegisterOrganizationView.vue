<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BuildingOffice2Icon, BuildingStorefrontIcon, CheckIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useForm } from '@/composables/useForm'
import FormField from '@/components/ui/FormField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import PasswordStrength from '@/components/ui/PasswordStrength.vue'
import LocationPicker from '@/components/maps/LocationPicker.vue'

const auth = useAuthStore()
const meta = useMetaStore()
const route = useRoute()
const router = useRouter()
onMounted(() => meta.load())

const step = ref(0)
// Hospitals & clinics get a 4th step for their own (in-house) pharmacy
const steps = computed(() => (org.value.type === 'hospital' ? ['Organization', 'Location', 'Administrator', 'Pharmacy'] : ['Organization', 'Location', 'Administrator']))
const lastStep = computed(() => steps.value.length - 1)

const form = useForm({
  organization: {
    type: route.query.type === 'hospital' ? 'hospital' : 'pharmacy',
    name: '', license_number: '', tin_number: '', phone: '', email: '',
    region: 'Addis Ababa', city: 'Addis Ababa', sub_city: '', woreda: '', address_line: '',
    opening_hours: 'Mon-Sat 8:00-21:00', is_24_hours: false, delivery_available: false,
    latitude: '', longitude: '',
    specialty_ids: [],
  },
  admin: { name: '', email: '', phone: '', password: '', password_confirmation: '' },
  has_pharmacy: null, // hospitals answer: do you have your own pharmacy?
  pharmacy: {
    name: '', license_number: '', phone: '', email: '', opening_hours: '', is_24_hours: false, delivery_available: false,
    admin: { name: '', email: '', phone: '', password: '', password_confirmation: '' },
  },
})
const org = computed(() => form.data.organization)
const ph = computed(() => form.data.pharmacy)
// Suggest a name for the hospital's pharmacy
watch(() => form.data.has_pharmacy, (yes) => {
  if (yes && !ph.value.name && org.value.name) ph.value.name = `${org.value.name} Pharmacy`
})

// Hospitals & clinics choose the specialties they offer (the list is managed by the MedLink team)
const specialties = ref([])
const specialtySearch = ref('')
onMounted(() => api.get('/public/specialties').then(({ data }) => (specialties.value = data.data)).catch(() => {}))
const shownSpecialties = computed(() => {
  const q = specialtySearch.value.trim().toLowerCase()
  return q ? specialties.value.filter((s) => s.name.toLowerCase().includes(q) || (s.name_am ?? '').includes(q)) : specialties.value
})
function toggleSpecialty(id) {
  const ids = org.value.specialty_ids
  const i = ids.indexOf(id)
  i >= 0 ? ids.splice(i, 1) : ids.push(id)
}
const hasPin = computed(() => org.value.latitude !== '' && org.value.latitude !== null && org.value.longitude !== '' && org.value.longitude !== null)

watch(() => org.value.region, (region) => {
  const cities = meta.citiesFor(region)
  if (!cities.includes(org.value.city)) org.value.city = cities[0] ?? ''
})

const stepFields = [
  ['organization.name', 'organization.license_number', 'organization.tin_number', 'organization.phone', 'organization.email', 'organization.specialty_ids'],
  ['organization.region', 'organization.city', 'organization.sub_city', 'organization.woreda', 'organization.address_line', 'organization.latitude', 'organization.longitude'],
  ['admin.name', 'admin.email', 'admin.phone', 'admin.password'],
  ['has_pharmacy', 'pharmacy', 'pharmacy.name', 'pharmacy.license_number', 'pharmacy.phone', 'pharmacy.email', 'pharmacy.opening_hours',
    'pharmacy.admin.name', 'pharmacy.admin.email', 'pharmacy.admin.phone', 'pharmacy.admin.password', 'pharmacy.admin.password_confirmation'],
]
const err = (key) => form.errors.value[key]

/** Messages for anything missing or mistyped on one step, keyed like the server's errors. */
function checkStep(i) {
  const o = org.value
  const a = form.data.admin
  const e = {}
  const digits = (v) => (v || '').replace(/\D/g, '')
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim())
  if (i === 0) {
    if (!o.name.trim()) e['organization.name'] = 'Enter the organization name.'
    if (!o.license_number.trim()) e['organization.license_number'] = 'Enter the licence number.'
    if (o.tin_number && digits(o.tin_number).length !== 10) e['organization.tin_number'] = 'The TIN must be exactly 10 digits.'
    if (!o.phone.trim()) e['organization.phone'] = 'Enter a phone number.'
    else if (digits(o.phone).length < 9) e['organization.phone'] = 'This phone number looks too short.'
    if (o.email && !isEmail(o.email)) e['organization.email'] = 'Enter a valid email address, e.g. info@pharmacy.et'
  }
  if (i === 1) {
    if (!o.region) e['organization.region'] = 'Choose a region.'
    if (!o.city) e['organization.city'] = 'Choose a city.'
  }
  if (i === 2) {
    if (!a.name.trim()) e['admin.name'] = "Enter the administrator's full name."
    if (!a.email.trim()) e['admin.email'] = "Enter the administrator's email."
    else if (!isEmail(a.email)) e['admin.email'] = 'Enter a valid email address.'
    if (!a.phone.trim()) e['admin.phone'] = 'Enter a mobile number.'
    else if (digits(a.phone).length < 9) e['admin.phone'] = 'This mobile number looks too short, e.g. 0911 234567.'
    if (!a.password) e['admin.password'] = 'Choose a password.'
    else if (a.password.length < 8 || !/[a-z]/.test(a.password) || !/[A-Z]/.test(a.password) || !/\d/.test(a.password)) {
      e['admin.password'] = 'Use at least 8 characters with upper and lower case letters and a number.'
    }
    if (a.password && a.password !== a.password_confirmation) e['admin.password_confirmation'] = 'The passwords do not match.'
  }
  if (i === 3) {
    const p = ph.value
    const pa = p.admin
    if (form.data.has_pharmacy === null) e.has_pharmacy = 'Tell us whether your hospital has its own pharmacy.'
    if (form.data.has_pharmacy) {
      if (!p.name.trim()) e['pharmacy.name'] = 'Enter the pharmacy name.'
      if (!p.license_number.trim()) e['pharmacy.license_number'] = "Enter the pharmacy's EFDA licence number."
      else if (p.license_number.trim() === o.license_number.trim()) e['pharmacy.license_number'] = 'The pharmacy has its own EFDA licence - enter that number, not the hospital licence.'
      if (p.phone && digits(p.phone).length < 9) e['pharmacy.phone'] = 'This phone number looks too short.'
      if (p.email && !isEmail(p.email)) e['pharmacy.email'] = 'Enter a valid email address.'
      if (!pa.name.trim()) e['pharmacy.admin.name'] = "Enter the pharmacist's full name."
      if (!pa.email.trim()) e['pharmacy.admin.email'] = "Enter the pharmacist's email."
      else if (!isEmail(pa.email)) e['pharmacy.admin.email'] = 'Enter a valid email address.'
      else if (pa.email.trim().toLowerCase() === a.email.trim().toLowerCase()) e['pharmacy.admin.email'] = 'The pharmacy needs its own login - use a different email from the hospital administrator.'
      if (!pa.phone.trim()) e['pharmacy.admin.phone'] = 'Enter a mobile number.'
      else if (digits(pa.phone).length < 9) e['pharmacy.admin.phone'] = 'This mobile number looks too short, e.g. 0911 234567.'
      else if (digits(pa.phone).slice(-9) === digits(a.phone).slice(-9)) e['pharmacy.admin.phone'] = 'Use a different mobile number from the hospital administrator.'
      if (!pa.password) e['pharmacy.admin.password'] = 'Choose a password.'
      else if (pa.password.length < 8 || !/[a-z]/.test(pa.password) || !/[A-Z]/.test(pa.password) || !/\d/.test(pa.password)) {
        e['pharmacy.admin.password'] = 'Use at least 8 characters with upper and lower case letters and a number.'
      }
      if (pa.password && pa.password !== pa.password_confirmation) e['pharmacy.admin.password_confirmation'] = 'The passwords do not match.'
    }
  }
  return e
}

/** Shows this step's problems under the fields; true when the step is complete. */
function validateStep(i) {
  const e = checkStep(i)
  // Keep errors from other steps, replace this step's
  const others = Object.fromEntries(Object.entries(form.errors.value).filter(([k]) => !stepKeys(i).includes(k)))
  form.errors.value = { ...others, ...e }
  return Object.keys(e).length === 0
}
const stepKeys = (i) => [...stepFields[i], ...(i === 2 ? ['admin.password_confirmation'] : [])]
const stepIndexes = () => steps.value.map((_, i) => i)

function next() {
  if (validateStep(step.value)) step.value++
}

/** A message for errors that do not belong to a field on the form. */
const generalError = ref('')

async function submit() {
  generalError.value = ''
  // Check every step first and open the first one with a problem
  const bad = stepIndexes().find((i) => !validateStep(i))
  if (bad !== undefined) {
    step.value = bad
    return
  }
  try {
    // Only hospitals send an in-house pharmacy
    const payload = { ...form.data, has_pharmacy: org.value.type === 'hospital' && !!form.data.has_pharmacy }
    if (!payload.has_pharmacy) delete payload.pharmacy
    await form.submit(() => auth.registerOrganization(payload))
    router.push({ name: 'pending' })
  } catch (e) {
    // Jump back to the first step that has an error from the server
    const badStep = stepIndexes().findIndex((i) => stepKeys(i).some((f) => form.errors.value[f]))
    if (badStep >= 0) step.value = badStep
    else if (e?.status !== 500 && Object.keys(form.errors.value).length) {
      generalError.value = Object.values(form.errors.value).join(' ')
    }
  }
}
</script>

<template>
  <div>
    <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">Register your organization</h1>
    <p class="mt-2 text-slate-500">Join MedLink Ethiopia. Our team verifies your EFDA / Ministry of Health licence before you go live (usually 1-2 working days).</p>
    <p class="mt-3 inline-flex items-center gap-2 rounded-full bg-gold-100 px-3 py-1 text-sm font-bold text-amber-800 ring-1 ring-gold-300">🎁 First month free on every plan · no payment needed to start</p>

    <!-- stepper -->
    <ol class="mt-8 flex items-center gap-2">
      <li v-for="(s, i) in steps" :key="s" class="flex flex-1 items-center gap-2">
        <button
          type="button"
          class="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition"
          :class="i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-600 text-white ring-4 ring-brand-500/20' : 'bg-slate-100 text-slate-400'"
          @click="i < step && (step = i)"
        >
          <CheckIcon v-if="i < step" class="size-4" /><template v-else>{{ i + 1 }}</template>
        </button>
        <span class="hidden text-sm font-semibold sm:block" :class="i <= step ? 'text-slate-900' : 'text-slate-400'">{{ s }}</span>
        <span v-if="i < steps.length - 1" class="h-px flex-1 bg-slate-200" />
      </li>
    </ol>

    <form class="mt-8" novalidate @submit.prevent="step < lastStep ? next() : submit()">
      <p v-if="generalError" class="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{{ generalError }}</p>
      <div v-show="step === 0" class="grid gap-4 sm:grid-cols-2">
        <div class="grid grid-cols-2 gap-3 sm:col-span-2">
          <button
            v-for="opt in [{ v: 'pharmacy', l: 'Pharmacy', d: 'Sell & dispense medicines', i: BuildingStorefrontIcon }, { v: 'hospital', l: 'Hospital / Clinic', d: 'Issue digital prescriptions', i: BuildingOffice2Icon }]"
            :key="opt.v"
            type="button"
            class="rounded-2xl border-2 p-4 text-left transition"
            :class="org.type === opt.v ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-600/10' : 'border-slate-200 hover:border-slate-300'"
            @click="org.type = opt.v"
          >
            <component :is="opt.i" class="size-7" :class="org.type === opt.v ? 'text-brand-600' : 'text-slate-400'" />
            <b class="mt-2 block text-slate-900">{{ opt.l }}</b>
            <span class="text-xs text-slate-500">{{ opt.d }}</span>
          </button>
        </div>
        <FormField label="Organization name" :error="err('organization.name')" class="sm:col-span-2" required>
          <input v-model="org.name" class="input" :placeholder="org.type === 'pharmacy' ? 'e.g. Bole Medhanit Pharmacy' : 'e.g. Entoto Hills General Hospital'" required />
        </FormField>
        <FormField :label="org.type === 'pharmacy' ? 'EFDA licence number' : 'MoH facility licence number'" :error="err('organization.license_number')" required>
          <input v-model="org.license_number" class="input" placeholder="EFDA/RP/0000/2016" required />
        </FormField>
        <FormField label="TIN (optional)" :error="err('organization.tin_number')" hint="10-digit taxpayer number">
          <input v-model="org.tin_number" class="input" inputmode="numeric" maxlength="10" placeholder="0012345678" />
        </FormField>
        <FormField label="Phone" :error="err('organization.phone')" hint="Mobile or landline, e.g. 011 551 2345" required>
          <input v-model="org.phone" type="tel" class="input" required />
        </FormField>
        <FormField label="Email (optional)" :error="err('organization.email')">
          <input v-model="org.email" type="email" class="input" />
        </FormField>
        <div v-if="org.type === 'hospital' && specialties.length" class="sm:col-span-2">
          <p class="field-label">Specialties you offer <span class="font-normal text-slate-400">(optional)</span></p>
          <p class="mb-2 text-xs text-slate-500">Patients find you by these when they search “near me” or book an appointment. No specialists yet? Skip this - you can add them any time later on your Organization page.</p>
          <input v-if="specialties.length > 10" v-model="specialtySearch" type="search" class="input mb-2" placeholder="Search, e.g. orthopedics" />
          <div class="flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-xl p-1" :class="err('organization.specialty_ids') && 'ring-1 ring-rose-300'">
            <button
              v-for="s in shownSpecialties"
              :key="s.id"
              type="button"
              class="rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition"
              :class="org.specialty_ids.includes(s.id) ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-400'"
              @click="toggleSpecialty(s.id)"
            >{{ org.specialty_ids.includes(s.id) ? '✓ ' : '' }}{{ s.name }}</button>
          </div>
          <p v-if="err('organization.specialty_ids')" class="field-error mt-1">{{ err('organization.specialty_ids') }}</p>
          <p v-else-if="org.specialty_ids.length" class="mt-1 text-xs font-semibold text-brand-700">{{ org.specialty_ids.length }} selected</p>
        </div>
      </div>

      <div v-show="step === 1" class="grid gap-4 sm:grid-cols-2">
        <FormField label="Region" label-am="ክልል" :error="err('organization.region')" required>
          <select v-model="org.region" class="input">
            <option v-for="r in meta.regions" :key="r.name" :value="r.name">{{ r.name }} · {{ r.name_am }}</option>
          </select>
        </FormField>
        <FormField label="City" label-am="ከተማ" :error="err('organization.city')" required>
          <select v-model="org.city" class="input">
            <option v-for="c in meta.citiesFor(org.region)" :key="c" :value="c">{{ c }}</option>
          </select>
        </FormField>
        <FormField v-if="org.city === 'Addis Ababa'" label="Sub-city" label-am="ክፍለ ከተማ" :error="err('organization.sub_city')">
          <select v-model="org.sub_city" class="input">
            <option value="">Select…</option>
            <option v-for="s in meta.subCities" :key="s" :value="s">{{ s }}</option>
          </select>
        </FormField>
        <FormField label="Woreda" label-am="ወረዳ" :error="err('organization.woreda')">
          <input v-model="org.woreda" class="input" placeholder="e.g. 03" />
        </FormField>
        <FormField label="Street / landmark" :error="err('organization.address_line')" class="sm:col-span-2" hint="Landmarks help customers find you - e.g. “opposite Edna Mall”">
          <input v-model="org.address_line" class="input" />
        </FormField>
        <div class="sm:col-span-2">
          <p class="field-label">Your location on the map <span class="font-normal text-slate-400">(recommended)</span></p>
          <p class="mb-3 text-xs text-slate-500">
            Patients searching <b>near me</b> only find you once your pin is set. If you are at your {{ org.type === 'pharmacy' ? 'pharmacy' : 'facility' }} now, press
            <b>Use this device's location</b>; otherwise click the map or drag the pin to your entrance.
          </p>
          <LocationPicker v-model:lat="org.latitude" v-model:lng="org.longitude" :label="org.name" />
          <p v-if="err('organization.latitude') || err('organization.longitude')" class="field-error mt-2">{{ err('organization.latitude') || err('organization.longitude') }}</p>
          <p v-else-if="hasPin" class="mt-2 text-xs font-semibold text-brand-700">✓ Pin set ({{ Number(org.latitude).toFixed(5) }}, {{ Number(org.longitude).toFixed(5) }})</p>
          <p v-else class="mt-2 text-xs text-amber-700">No pin yet - you can also set it later from your Organization page.</p>
        </div>
        <FormField label="Opening hours" class="sm:col-span-2">
          <input v-model="org.opening_hours" class="input" />
        </FormField>
        <div class="card space-y-4 p-4 sm:col-span-2">
          <ToggleSwitch v-model="org.is_24_hours" label="Open 24 hours" description="Shown with a 24/7 badge" />
          <ToggleSwitch v-if="org.type === 'pharmacy'" v-model="org.delivery_available" label="We deliver" description="Customers can choose home delivery" />
        </div>
      </div>

      <div v-show="step === 2" class="grid gap-4 sm:grid-cols-2">
        <p class="rounded-xl bg-brand-50 p-3 text-sm text-brand-800 sm:col-span-2">This person becomes the {{ org.type === 'pharmacy' ? 'pharmacy' : 'hospital' }} administrator and can add the rest of the team later.</p>
        <FormField label="Full name" :error="err('admin.name')" class="sm:col-span-2" required>
          <input v-model="form.data.admin.name" class="input" required />
        </FormField>
        <FormField label="Email" :error="err('admin.email')" required>
          <input v-model="form.data.admin.email" type="email" class="input" required />
        </FormField>
        <FormField label="Mobile" :error="err('admin.phone')" required>
          <input v-model="form.data.admin.phone" type="tel" class="input" placeholder="09XX XXX XXX" required />
        </FormField>
        <FormField label="Password" :error="err('admin.password')" required>
          <input v-model="form.data.admin.password" type="password" class="input" autocomplete="new-password" required />
          <PasswordStrength :password="form.data.admin.password" />
        </FormField>
        <FormField label="Confirm password" :error="err('admin.password_confirmation')" required>
          <input v-model="form.data.admin.password_confirmation" type="password" class="input" autocomplete="new-password" required />
        </FormField>
      </div>

      <!-- Hospitals & clinics: their own pharmacy (it has its own EFDA licence and its own login) -->
      <div v-if="org.type === 'hospital'" v-show="step === 3" class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <p class="field-label">Does your hospital have its own pharmacy?</p>
          <div class="mt-1 grid grid-cols-2 gap-3">
            <button
              v-for="opt in [{ v: true, l: 'Yes, we have a pharmacy', d: 'Register it now with its EFDA licence' }, { v: false, l: 'No pharmacy', d: 'Patients take prescriptions to any pharmacy' }]"
              :key="String(opt.v)"
              type="button"
              class="rounded-2xl border-2 p-4 text-left transition"
              :class="form.data.has_pharmacy === opt.v ? 'border-brand-500 bg-brand-50 shadow-md shadow-brand-600/10' : 'border-slate-200 hover:border-slate-300'"
              @click="form.data.has_pharmacy = opt.v"
            >
              <BuildingStorefrontIcon class="size-6" :class="form.data.has_pharmacy === opt.v ? 'text-brand-600' : 'text-slate-400'" />
              <b class="mt-2 block text-slate-900">{{ opt.l }}</b>
              <span class="text-xs text-slate-500">{{ opt.d }}</span>
            </button>
          </div>
          <p v-if="err('has_pharmacy')" class="field-error mt-1">{{ err('has_pharmacy') }}</p>
        </div>

        <template v-if="form.data.has_pharmacy">
          <p class="rounded-xl bg-brand-50 p-3 text-sm text-brand-800 sm:col-span-2">
            Your pharmacy gets its own MedLink pharmacy account at the hospital's address: its own stock, sales and e-prescription inbox, and its own first free month.
            MedLink verifies its EFDA licence together with your hospital.
          </p>
          <FormField label="Pharmacy name" :error="err('pharmacy.name')" class="sm:col-span-2" required>
            <input v-model="ph.name" class="input" :placeholder="`${org.name || 'Entoto Hospital'} Pharmacy`" />
          </FormField>
          <FormField label="Pharmacy EFDA licence number" :error="err('pharmacy.license_number')" hint="The pharmacy's own licence, not the hospital's" required>
            <input v-model="ph.license_number" class="input" placeholder="EFDA/RP/0000/2016" />
          </FormField>
          <FormField label="Pharmacy phone (optional)" :error="err('pharmacy.phone')" hint="Leave empty to use the hospital phone">
            <input v-model="ph.phone" type="tel" class="input" />
          </FormField>
          <FormField label="Pharmacy email (optional)" :error="err('pharmacy.email')">
            <input v-model="ph.email" type="email" class="input" />
          </FormField>
          <FormField label="Opening hours (optional)" :error="err('pharmacy.opening_hours')" :hint="`Leave empty to use the hospital's: ${org.opening_hours || '-'}`">
            <input v-model="ph.opening_hours" class="input" />
          </FormField>
          <div class="card space-y-4 p-4 sm:col-span-2">
            <ToggleSwitch v-model="ph.is_24_hours" label="Pharmacy open 24 hours" description="Shown with a 24/7 badge" />
            <ToggleSwitch v-model="ph.delivery_available" label="We deliver" description="Customers can choose home delivery" />
          </div>

          <p class="mt-2 font-bold text-slate-900 sm:col-span-2">Pharmacist in charge</p>
          <p class="-mt-3 text-xs text-slate-500 sm:col-span-2">This person signs in to the pharmacy account and can add the rest of the pharmacy team. Use a different email and mobile from the hospital administrator.</p>
          <FormField label="Full name" :error="err('pharmacy.admin.name')" class="sm:col-span-2" required>
            <input v-model="ph.admin.name" class="input" />
          </FormField>
          <FormField label="Email" :error="err('pharmacy.admin.email')" required>
            <input v-model="ph.admin.email" type="email" class="input" autocomplete="off" />
          </FormField>
          <FormField label="Mobile" :error="err('pharmacy.admin.phone')" required>
            <input v-model="ph.admin.phone" type="tel" class="input" placeholder="09XX XXX XXX" />
          </FormField>
          <FormField label="Password" :error="err('pharmacy.admin.password')" required>
            <input v-model="ph.admin.password" type="password" class="input" autocomplete="new-password" />
            <PasswordStrength :password="ph.admin.password" />
          </FormField>
          <FormField label="Confirm password" :error="err('pharmacy.admin.password_confirmation')" required>
            <input v-model="ph.admin.password_confirmation" type="password" class="input" autocomplete="new-password" />
          </FormField>
        </template>
      </div>

      <div class="mt-8 flex items-center justify-between gap-3">
        <button v-if="step > 0" type="button" class="btn btn-secondary" @click="step--">Back</button>
        <RouterLink v-else :to="{ name: 'login' }" class="text-sm font-semibold text-slate-500 hover:text-slate-700">Already registered? Sign in</RouterLink>
        <button class="btn btn-primary" :disabled="form.processing.value">
          <AppSpinner v-if="form.processing.value" /> {{ step < lastStep ? 'Continue' : 'Submit for verification' }}
        </button>
      </div>
    </form>
  </div>
</template>
