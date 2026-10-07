<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ExclamationTriangleIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { phone } from '@/lib/format'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormField from '@/components/ui/FormField.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// Frequencies with doses per day, so the total quantity can be suggested
const FREQUENCIES = [
  { label: 'Once daily', perDay: 1 }, { label: 'Twice daily', perDay: 2 }, { label: '3 times daily', perDay: 3 },
  { label: '4 times daily', perDay: 4 }, { label: 'Every 8 hours', perDay: 3 }, { label: 'At night', perDay: 1 },
  { label: 'As needed (PRN)', perDay: 2 }, { label: 'Single dose', perDay: 1 },
]

const patient = ref(null)
const patientQuery = ref('')
const patientResults = ref([])
const medQuery = ref('')
const medResults = ref([])
const form = useForm({ diagnosis: '', notes: '', validity_days: 30, items: [] })

onMounted(async () => {
  if (route.query.patient) patient.value = (await api.get(`/patients/${route.query.patient}`)).data.data.patient
})

let pt, mt
watch(patientQuery, (q) => {
  clearTimeout(pt)
  pt = setTimeout(async () => (patientResults.value = q.length < 2 ? [] : (await api.get('/patients', { params: { search: q, per_page: 6 } })).data.data), 250)
})
watch(medQuery, (q) => {
  clearTimeout(mt)
  mt = setTimeout(async () => (medResults.value = q.length < 2 ? [] : (await api.get('/medicines', { params: { search: q, active: 1, per_page: 8 } })).data.data), 250)
})

function addMedicine(m) {
  if (form.data.items.some((i) => i.medicine.id === m.id)) return
  form.data.items.push({ medicine: m, dosage: m.unit === 'tablet' || m.unit === 'capsule' ? `1 ${m.unit}` : '5 ml', frequency: '3 times daily', duration_days: 7, per_dose: 1, total_quantity: 21, instructions: '', touched: false })
  medQuery.value = ''
  medResults.value = []
}

/** Suggest total = units per dose x doses per day x days (for solid forms); stays editable. */
function suggest(item) {
  if (item.touched) return
  const perDay = FREQUENCIES.find((f) => f.label === item.frequency)?.perDay ?? 1
  const solid = ['tablet', 'capsule', 'sachet'].includes(item.medicine.unit)
  item.total_quantity = solid ? Math.max(1, Math.ceil(Number(item.per_dose || 1) * perDay * Number(item.duration_days || 1))) : 1
}

const allergyWarning = computed(() => {
  const allergies = patient.value?.allergies?.toLowerCase()
  if (!allergies) return null
  const hit = form.data.items.find((i) => allergies.split(/[,;]/).some((a) => a.trim() && (i.medicine.generic_name.toLowerCase().includes(a.trim()) || (a.trim().startsWith('penicillin') && /cillin/i.test(i.medicine.generic_name)))))
  return hit ? `${patient.value.full_name} is allergic to ${patient.value.allergies}. Check ${hit.medicine.display_name}.` : null
})

async function submit() {
  const payload = {
    patient_id: patient.value?.id,
    diagnosis: form.data.diagnosis,
    notes: form.data.notes,
    validity_days: form.data.validity_days,
    items: form.data.items.map((i) => ({ medicine_id: i.medicine.id, dosage: i.dosage, frequency: i.frequency, duration_days: i.duration_days, total_quantity: i.total_quantity, instructions: i.instructions })),
  }
  const data = await form.submit(() => api.post('/prescriptions', payload)).catch(() => null)
  if (data) router.push({ name: 'app.prescription', params: { id: data.data.id } })
}
</script>

<template>
  <div>
    <PageHeader title="Write prescription" eyebrow="Hospital" :subtitle="`Prescriber: ${auth.user?.name}${auth.user?.license_number ? ' · ' + auth.user.license_number : ''}`" />

    <div class="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <!-- Patient -->
      <section class="card card-pad h-fit">
        <h2 class="font-bold text-slate-900">1. Patient</h2>
        <div v-if="patient" class="mt-4 rounded-2xl border-2 border-brand-500 bg-brand-50 p-4">
          <div class="flex items-center gap-3">
            <UserAvatar :name="patient.full_name" />
            <div class="min-w-0 flex-1">
              <p class="font-bold text-slate-900">{{ patient.full_name }}</p>
              <p class="text-xs text-slate-500">{{ patient.age ?? '?' }} yrs · {{ patient.gender }} · {{ phone(patient.phone) }}</p>
              <p class="font-mono text-xs text-slate-400">{{ patient.mrn }}</p>
            </div>
          </div>
          <p v-if="patient.allergies" class="mt-3 rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700">⚠ Allergies: {{ patient.allergies }}</p>
          <button class="mt-3 text-xs font-semibold text-brand-700 hover:underline" @click="patient = null">Change patient</button>
        </div>
        <div v-else class="mt-4">
          <SearchInput v-model="patientQuery" placeholder="Name, card number or phone" />
          <ul v-if="patientResults.length" class="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
            <li v-for="p in patientResults" :key="p.id">
              <button class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-50" @click="patient = p">
                <UserAvatar :name="p.full_name" size="sm" />
                <span><b class="block text-sm">{{ p.full_name }}</b><span class="text-xs text-slate-500">{{ p.mrn }} · {{ phone(p.phone) }}</span></span>
              </button>
            </li>
          </ul>
          <p class="mt-3 text-xs text-slate-500">New patient? <RouterLink :to="{ name: 'app.patients' }" class="font-semibold text-brand-700">Register them first</RouterLink>.</p>
          <p v-if="form.errors.value.patient_id" class="field-error">{{ form.errors.value.patient_id }}</p>
        </div>

        <h2 class="mt-8 font-bold text-slate-900">2. Clinical notes</h2>
        <div class="mt-4 space-y-4">
          <FormField label="Diagnosis" :error="form.errors.value.diagnosis"><textarea v-model="form.data.diagnosis" rows="2" class="input" placeholder="e.g. Uncomplicated malaria (RDT +)" /></FormField>
          <FormField label="Notes for the pharmacist"><textarea v-model="form.data.notes" rows="2" class="input" /></FormField>
          <FormField label="Valid for" :error="form.errors.value.validity_days">
            <select v-model.number="form.data.validity_days" class="input">
              <option :value="7">7 days</option><option :value="14">14 days</option><option :value="30">30 days</option><option :value="60">60 days (chronic)</option><option :value="90">90 days (chronic)</option>
            </select>
          </FormField>
        </div>
      </section>

      <!-- Items -->
      <section class="card card-pad">
        <h2 class="font-bold text-slate-900">3. Medicines</h2>
        <div class="relative mt-4">
          <SearchInput v-model="medQuery" placeholder="Search the national catalogue, e.g. amoxicillin, coartem" />
          <ul v-if="medResults.length" class="absolute z-20 mt-2 max-h-72 w-full divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl scrollbar-thin">
            <li v-for="m in medResults" :key="m.id">
              <button class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-50" @click="addMedicine(m)">
                <MedicineAvatar :form="m.dosage_form" size="sm" />
                <span class="min-w-0 flex-1"><b class="block truncate text-sm">{{ m.display_name }}</b><span class="text-xs text-slate-500">{{ m.dosage_form }} · {{ m.manufacturer }}</span></span>
                <span v-if="m.is_controlled" class="chip bg-violet-50 text-violet-700 ring-violet-600/15">Controlled</span>
              </button>
            </li>
          </ul>
        </div>

        <div v-if="allergyWarning" class="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <ExclamationTriangleIcon class="size-5 shrink-0" /> {{ allergyWarning }}
        </div>

        <div class="mt-5 space-y-4">
          <div v-for="(item, i) in form.data.items" :key="item.medicine.id" class="rounded-2xl border border-slate-200 p-4">
            <div class="flex items-center gap-3">
              <span class="grid size-7 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{{ i + 1 }}</span>
              <MedicineAvatar :form="item.medicine.dosage_form" size="sm" />
              <p class="min-w-0 flex-1 truncate font-bold text-slate-900">{{ item.medicine.display_name }}</p>
              <button class="btn-icon size-8 hover:text-rose-600" @click="form.data.items.splice(i, 1)"><TrashIcon class="size-4" /></button>
            </div>
            <div class="mt-4 grid gap-3 sm:grid-cols-5">
              <FormField label="Dose" :error="form.errors.value[`items.${i}.dosage`]"><input v-model="item.dosage" class="input" /></FormField>
              <FormField label="Units / dose"><input v-model.number="item.per_dose" type="number" min="0.5" step="0.5" class="input" @input="suggest(item)" /></FormField>
              <FormField label="Frequency">
                <select v-model="item.frequency" class="input" @change="suggest(item)"><option v-for="f in FREQUENCIES" :key="f.label">{{ f.label }}</option></select>
              </FormField>
              <FormField label="Days" :error="form.errors.value[`items.${i}.duration_days`]"><input v-model.number="item.duration_days" type="number" min="1" class="input" @input="suggest(item)" /></FormField>
              <FormField :label="`Total (${item.medicine.unit}s)`" :error="form.errors.value[`items.${i}.total_quantity`]">
                <input v-model.number="item.total_quantity" type="number" min="1" class="input font-bold" @input="item.touched = true" />
              </FormField>
              <FormField label="Instructions" class="sm:col-span-5"><input v-model="item.instructions" class="input" placeholder="e.g. Take after meals. Complete the full course." /></FormField>
            </div>
          </div>
          <div v-if="!form.data.items.length" class="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
            <PlusIcon class="mx-auto size-8 text-slate-300" />
            Search above to add the first medicine.
          </div>
          <p v-if="form.errors.value.items" class="field-error">{{ form.errors.value.items }}</p>
        </div>

        <div class="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
          <p class="text-xs text-slate-500">A unique code and QR are generated. The patient can collect at any MedLink pharmacy, never more than prescribed.</p>
          <button class="btn btn-primary btn-lg" :disabled="form.processing.value || !patient || !form.data.items.length" @click="submit">
            <AppSpinner v-if="form.processing.value" /> Issue prescription
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
