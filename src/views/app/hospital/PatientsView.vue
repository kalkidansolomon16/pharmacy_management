<script setup>
import { ref, watch } from 'vue'
import { DocumentPlusIcon, PencilSquareIcon, PlusIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { phone } from '@/lib/format'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const meta = useMetaStore()
meta.load()
const canCreate = auth.can('patients.create')
const canEdit = auth.can('patients.update')

const { rows, meta: page, loading, filters, page: current, reload } = useList('/patients', { search: '' })
const editing = ref(null) // {} for new
const viewing = ref(null)

const blank = { full_name: '', phone: '', gender: 'female', date_of_birth: '', mrn: '', city: 'Addis Ababa', address: '', blood_group: '', allergies: '' }
const form = useForm(blank)
watch(editing, (p) => p && form.reset(p.id ? { ...blank, ...p, phone: phone(p.phone) } : blank))

async function save() {
  const req = editing.value.id ? () => api.put(`/patients/${editing.value.id}`, form.data) : () => api.post('/patients', form.data)
  await form.submit(req, { onSuccess: () => { editing.value = null; reload() } }).catch(() => {})
}

async function view(p) {
  viewing.value = { patient: p, prescriptions: null }
  viewing.value = (await api.get(`/patients/${p.id}`)).data.data
}

const columns = [
  { key: 'name', label: 'Patient' },
  { key: 'mrn', label: 'Card no.' },
  { key: 'phone', label: 'Phone' },
  { key: 'age', label: 'Age / sex' },
  { key: 'rx', label: 'Prescriptions', align: 'center' },
  { key: 'actions', label: '', align: 'right' },
]
</script>

<template>
  <div>
    <PageHeader title="Patients" eyebrow="Hospital" :subtitle="auth.hasRole('doctor') ? 'Your patients, and patients no doctor has seen yet. Patients of other doctors are on their own lists - reception can see everyone.' : 'Patient register for your facility. The phone number lets patients verify and collect their prescriptions.'">
      <button v-if="canCreate" class="btn btn-primary" @click="editing = {}"><PlusIcon class="size-4" /> Register patient</button>
    </PageHeader>

    <div class="card overflow-hidden">
      <div class="border-b border-slate-100 p-4"><SearchInput v-model="filters.search" placeholder="Name, card number (MRN) or phone" /></div>
      <DataTable :columns="columns" :rows="rows" :loading="loading" clickable empty-title="No patients yet" @row-click="view">
        <template #cell-name="{ row }">
          <div class="flex items-center gap-3">
            <UserAvatar :name="row.full_name" size="sm" />
            <div>
              <p class="font-semibold text-slate-900">{{ row.full_name }}</p>
              <p v-if="row.allergies" class="text-xs font-semibold text-rose-600">⚠ {{ row.allergies }}</p>
            </div>
          </div>
        </template>
        <template #cell-mrn="{ row }"><span class="font-mono text-xs">{{ row.mrn || '—' }}</span></template>
        <template #cell-phone="{ row }">{{ phone(row.phone) }}</template>
        <template #cell-age="{ row }">{{ row.age ?? '—' }} · {{ row.gender === 'female' ? 'F' : 'M' }}<span v-if="row.blood_group" class="ml-1 text-xs text-slate-400">{{ row.blood_group }}</span></template>
        <template #cell-rx="{ row }">{{ row.prescriptions_count }}</template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1" @click.stop>
            <RouterLink v-if="auth.can('prescriptions.create')" :to="{ name: 'app.prescriptions.new', query: { patient: row.id } }" class="btn btn-ghost btn-sm"><DocumentPlusIcon class="size-4" /> Prescribe</RouterLink>
            <button v-if="canEdit" class="btn-icon size-8" @click="editing = row"><PencilSquareIcon class="size-4" /></button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="current" :meta="page" />
    </div>

    <AppModal :open="!!editing" :title="editing?.id ? 'Edit patient' : 'Register patient'" size="lg" @close="editing = null">
      <form id="patient-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <FormField label="Full name" label-am="ሙሉ ስም" :error="form.errors.value.full_name" class="sm:col-span-2" required><input v-model="form.data.full_name" class="input" required /></FormField>
        <FormField label="Mobile" :error="form.errors.value.phone" hint="Used to verify prescriptions" required><input v-model="form.data.phone" type="tel" class="input" placeholder="09XX XXX XXX" required /></FormField>
        <FormField label="Card number (MRN)" :error="form.errors.value.mrn"><input v-model="form.data.mrn" class="input font-mono" placeholder="EHG-001234" /></FormField>
        <FormField label="Sex" :error="form.errors.value.gender">
          <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            <button v-for="g in ['female', 'male']" :key="g" type="button" class="rounded-lg py-1.5 capitalize" :class="form.data.gender === g ? 'bg-white shadow-sm' : 'text-slate-500'" @click="form.data.gender = g">{{ g }}</button>
          </div>
        </FormField>
        <FormField label="Date of birth" :error="form.errors.value.date_of_birth"><input v-model="form.data.date_of_birth" type="date" class="input" /></FormField>
        <FormField label="Blood group">
          <select v-model="form.data.blood_group" class="input"><option value="">Unknown</option><option v-for="b in meta.bloodGroups" :key="b">{{ b }}</option></select>
        </FormField>
        <FormField label="City">
          <select v-model="form.data.city" class="input"><option v-for="c in meta.allCities" :key="c">{{ c }}</option></select>
        </FormField>
        <FormField label="Address" class="sm:col-span-2"><input v-model="form.data.address" class="input" placeholder="Sub-city, woreda, kebele" /></FormField>
        <FormField label="Known allergies" class="sm:col-span-2" hint="Shown to pharmacists when they dispense"><input v-model="form.data.allergies" class="input" placeholder="e.g. Penicillin" /></FormField>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editing = null">Cancel</button>
        <button form="patient-form" class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Save patient</button>
      </template>
    </AppModal>

    <AppModal :open="!!viewing" :title="viewing?.patient.full_name" :subtitle="viewing ? `${phone(viewing.patient.phone)} · ${viewing.patient.mrn ?? 'no card number'}` : ''" size="lg" @close="viewing = null">
      <div v-if="viewing" class="space-y-4">
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">Age / sex</p><b>{{ viewing.patient.age ?? '—' }} · {{ viewing.patient.gender }}</b></div>
          <div class="rounded-xl bg-slate-50 p-3"><p class="text-xs text-slate-500">Blood group</p><b>{{ viewing.patient.blood_group || '—' }}</b></div>
          <div class="rounded-xl p-3" :class="viewing.patient.allergies ? 'bg-rose-50 text-rose-700' : 'bg-slate-50'"><p class="text-xs opacity-70">Allergies</p><b>{{ viewing.patient.allergies || 'None known' }}</b></div>
        </div>
        <h3 class="font-bold text-slate-900">Prescription history</h3>
        <div v-if="!viewing.prescriptions" class="skeleton h-24" />
        <ul v-else class="divide-y divide-slate-100 rounded-2xl border border-slate-200">
          <li v-for="p in viewing.prescriptions" :key="p.id">
            <RouterLink :to="{ name: 'app.prescription', params: { id: p.id } }" class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <span class="min-w-0 flex-1">
                <span class="block font-mono text-sm font-bold">{{ p.reference_code }}</span>
                <span class="block truncate text-xs text-slate-500">{{ p.items.map((i) => i.medicine?.display_name).join(', ') }}</span>
              </span>
              <StatusBadge :status="p.status" />
              <span class="text-xs text-slate-400"><DateText :value="p.issued_at" /></span>
            </RouterLink>
          </li>
          <li v-if="!viewing.prescriptions.length" class="px-4 py-6 text-center text-sm text-slate-500">No prescriptions yet.</li>
        </ul>
      </div>
      <template #footer>
        <RouterLink v-if="viewing && auth.can('prescriptions.create')" :to="{ name: 'app.prescriptions.new', query: { patient: viewing.patient.id } }" class="btn btn-primary"><DocumentPlusIcon class="size-4" /> New prescription</RouterLink>
      </template>
    </AppModal>
  </div>
</template>
