<script setup>
/**
 * Add a catalogue medicine to the pharmacy (with optional opening batch), or edit an existing listing's price/visibility.
 */
import { computed, ref, watch } from 'vue'
import { CheckCircleIcon } from '@heroicons/vue/24/solid'
import api from '@/lib/api'
import { addDaysIso } from '@/lib/format'
import { useForm } from '@/composables/useForm'
import { useMetaStore } from '@/stores/meta'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import MedicineFormModal from '@/components/inventory/MedicineFormModal.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ open: Boolean, listing: { type: Object, default: null } })
const emit = defineEmits(['close', 'saved'])
const meta = useMetaStore()
meta.load()

const editing = computed(() => !!props.listing)
const search = ref('')
const results = ref([])
const selected = ref(null)
const withBatch = ref(true)
const auth = useAuthStore()
// Not in the catalogue yet: pharmacies with the permission add it here and stock it straight away
const addingMedicine = ref(false)
const canAddMedicine = computed(() => auth.can('catalog.contribute') || auth.can('catalog.manage'))
function medicineAdded(m) {
  addingMedicine.value = false
  if (m) selected.value = m
}

const form = useForm({})
watch(() => props.open, (open) => {
  if (!open) return
  selected.value = props.listing?.medicine ?? null
  search.value = ''
  results.value = []
  withBatch.value = true
  form.reset({
    price: props.listing?.price ?? '',
    reorder_level: props.listing?.reorder_level ?? 20,
    is_public: props.listing?.is_public ?? true,
    batch: { batch_number: '', quantity: '', expiry_date: addDaysIso(365), purchase_price: '', supplier: 'EPSS (Ethiopian Pharmaceutical Supply Service)' },
  })
})

let timer
watch(search, (q) => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    if (!q || q.length < 2) return (results.value = [])
    results.value = (await api.get('/medicines', { params: { search: q, active: 1, per_page: 8 } })).data.data
  }, 250)
})

async function submit() {
  const payload = { price: form.data.price, reorder_level: form.data.reorder_level, is_public: form.data.is_public }
  const request = editing.value
    ? () => api.put(`/inventory/${props.listing.id}`, payload)
    : () => api.post('/inventory', { ...payload, medicine_id: selected.value?.id, batch: withBatch.value ? form.data.batch : null })
  await form.submit(request, { onSuccess: (data) => emit('saved', data?.data) }).catch(() => {})
}
</script>

<template>
  <AppModal :open="open" :title="editing ? 'Edit listing' : 'Add medicine to inventory'" :subtitle="editing ? listing.medicine.display_name : 'Choose from the national catalogue, set your price and receive the opening stock.'" size="lg" @close="emit('close')">
    <form id="listing-form" class="space-y-6" @submit.prevent="submit">
      <div v-if="!editing">
        <p class="field-label">Medicine</p>
        <div v-if="selected" class="flex items-center gap-3 rounded-2xl border-2 border-brand-500 bg-brand-50 p-3">
          <MedicineAvatar :form="selected.dosage_form" />
          <div class="min-w-0 flex-1">
            <p class="font-bold text-slate-900">{{ selected.display_name }}</p>
            <p class="text-xs text-slate-500">{{ selected.dosage_form }} · {{ selected.manufacturer }} <span v-if="selected.prescription_required" class="font-semibold text-rose-600">· Rx</span></p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" @click="selected = null">Change</button>
        </div>
        <template v-else>
          <SearchInput v-model="search" placeholder="Type a generic or brand name, e.g. amoxicillin" />
          <ul v-if="results.length" class="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 scrollbar-thin">
            <li v-for="m in results" :key="m.id">
              <button type="button" class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-50" @click="selected = m">
                <MedicineAvatar :form="m.dosage_form" size="sm" />
                <span class="min-w-0 flex-1"><b class="block truncate text-sm text-slate-900">{{ m.display_name }}</b><span class="text-xs text-slate-500">{{ m.dosage_form }} · {{ m.category?.name }}</span></span>
                <span v-if="m.review_status === 'pending'" class="chip bg-amber-50 text-amber-700 ring-amber-600/20">Awaiting review</span>
                <span v-if="m.prescription_required" class="chip bg-rose-50 text-rose-700 ring-rose-600/15">Rx</span>
              </button>
            </li>
          </ul>
          <p v-else-if="search.length >= 2" class="mt-2 text-sm text-slate-500">No matches.<template v-if="!canAddMedicine"> Ask your pharmacy admin to add it.</template></p>
          <button v-if="canAddMedicine" type="button" class="btn btn-ghost btn-sm mt-2 px-0 text-brand-700" @click="addingMedicine = true">+ Can't find it? Add a new medicine</button>
          <p v-if="form.errors.value.medicine_id" class="field-error">{{ form.errors.value.medicine_id }}</p>
        </template>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <FormField label="Selling price (ETB)" :hint="`per ${(selected ?? listing?.medicine)?.unit ?? 'unit'}`" :error="form.errors.value.price" required>
          <input v-model="form.data.price" type="number" min="0.01" step="0.01" class="input" required />
        </FormField>
        <FormField label="Reorder level" hint="Alert when stock falls to this" :error="form.errors.value.reorder_level">
          <input v-model="form.data.reorder_level" type="number" min="0" class="input" />
        </FormField>
        <div class="flex items-end pb-2"><ToggleSwitch v-model="form.data.is_public" label="Visible to customers" /></div>
      </div>

      <div v-if="!editing" class="rounded-2xl border border-slate-200 p-4">
        <ToggleSwitch v-model="withBatch" label="Receive opening stock now" description="Record the first batch with its expiry date" />
        <div v-if="withBatch" class="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField label="Batch number" :error="form.errors.value['batch.batch_number']" required><input v-model="form.data.batch.batch_number" class="input font-mono uppercase" required /></FormField>
          <FormField label="Quantity" :error="form.errors.value['batch.quantity']" required><input v-model="form.data.batch.quantity" type="number" min="1" class="input" required /></FormField>
          <FormField label="Expiry date" :error="form.errors.value['batch.expiry_date']" required><input v-model="form.data.batch.expiry_date" type="date" :min="addDaysIso(1)" class="input" required /></FormField>
          <FormField label="Purchase price / unit" :error="form.errors.value['batch.purchase_price']" required><input v-model="form.data.batch.purchase_price" type="number" min="0" step="0.01" class="input" required /></FormField>
          <FormField label="Supplier" class="sm:col-span-2">
            <select v-model="form.data.batch.supplier" class="input"><option v-for="s in meta.suppliers" :key="s" :value="s">{{ s }}</option></select>
          </FormField>
        </div>
      </div>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="emit('close')">Cancel</button>
      <button form="listing-form" class="btn btn-primary" :disabled="form.processing.value || (!editing && !selected)">
        <AppSpinner v-if="form.processing.value" /><CheckCircleIcon v-else class="size-4" /> {{ editing ? 'Save changes' : 'Add to inventory' }}
      </button>
    </template>
  </AppModal>
  <MedicineFormModal :open="addingMedicine" :initial-name="search" @close="addingMedicine = false" @saved="medicineAdded" />
</template>
