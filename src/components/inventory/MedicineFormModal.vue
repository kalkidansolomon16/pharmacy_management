<script setup>
/**
 * Add or edit a catalogue medicine. The platform team edits the shared catalogue directly; pharmacies and
 * hospitals with "Add medicines & categories" add entries that they can use at once and that the
 * MedLink team reviews before they are shared with everyone.
 */
import { computed, ref, watch } from 'vue'
import { InformationCircleIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const props = defineProps({
  open: Boolean,
  medicine: { type: Object, default: null }, // editing when set
  initialName: { type: String, default: '' }, // prefill from a search that found nothing
})
const emit = defineEmits(['close', 'saved'])

const auth = useAuthStore()
const meta = useMetaStore()
meta.load()
const isPlatform = computed(() => auth.can('catalog.manage'))
const categories = ref([])

const units = ['tablet', 'capsule', 'bottle', 'vial', 'tube', 'sachet', 'inhaler', 'ampoule', 'pack', 'piece']
const blank = {
  generic_name: '', brand_name: '', manufacturer: '', category_id: '', dosage_form: 'Tablet', strength: '', unit: 'tablet', barcode: '',
  prescription_required: false, is_controlled: false, storage_conditions: 'Store below 30°C', description: '', is_active: true,
}
const form = useForm(blank)

watch(() => props.open, async (open) => {
  if (!open) return
  const m = props.medicine
  form.reset(m ? { ...blank, ...m, category_id: m.category_id ?? '', barcode: m.barcode ?? '' } : { ...blank, generic_name: props.initialName })
  categories.value = (await api.get('/categories')).data.data
})

async function save() {
  const payload = { ...form.data, category_id: form.data.category_id || null, barcode: form.data.barcode || null }
  if (!isPlatform.value) delete payload.is_active
  const request = props.medicine ? () => api.put(`/medicines/${props.medicine.id}`, payload) : () => api.post('/medicines', payload)
  await form.submit(request, { onSuccess: (data) => emit('saved', data?.data) }).catch(() => {})
}
</script>

<template>
  <AppModal :open="open" :title="medicine ? 'Edit medicine' : 'Add a new medicine'" size="lg" @close="emit('close')">
    <div v-if="!isPlatform" class="mb-5 flex gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
      <InformationCircleIcon class="size-5 shrink-0" />
      <p>You can stock and sell it straight away. The MedLink team checks it before it is shared with other pharmacies and with doctors. Please use the official generic (INN) name and the exact strength on the pack.</p>
    </div>
    <p v-if="medicine?.review_status === 'rejected'" class="mb-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800"><b>Not approved:</b> {{ medicine.review_note }}. Correct it and save to send it for review again.</p>

    <form id="medicine-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
      <FormField label="Generic name (INN)" :error="form.errors.value.generic_name" class="sm:col-span-2" required><input v-model="form.data.generic_name" class="input" placeholder="e.g. Amoxicillin" required /></FormField>
      <FormField label="Strength" :error="form.errors.value.strength" required><input v-model="form.data.strength" class="input" placeholder="500mg" required /></FormField>
      <FormField label="Brand name" :error="form.errors.value.brand_name"><input v-model="form.data.brand_name" class="input" /></FormField>
      <FormField label="Dosage form" :error="form.errors.value.dosage_form" required>
        <select v-model="form.data.dosage_form" class="input"><option v-for="d in meta.dosageForms" :key="d">{{ d }}</option></select>
      </FormField>
      <FormField label="Dispensing unit" :error="form.errors.value.unit" required>
        <select v-model="form.data.unit" class="input"><option v-for="u in units" :key="u">{{ u }}</option></select>
      </FormField>
      <FormField label="Category" :error="form.errors.value.category_id">
        <select v-model="form.data.category_id" class="input">
          <option value="">—</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}{{ c.review_status === 'pending' ? ' (awaiting review)' : '' }}</option>
        </select>
      </FormField>
      <FormField label="Manufacturer"><input v-model="form.data.manufacturer" class="input" placeholder="e.g. EPHARM" /></FormField>
      <FormField label="Barcode (GTIN)" :error="form.errors.value.barcode" hint="Scan the pack to fill it"><input v-model="form.data.barcode" class="input font-mono" /></FormField>
      <FormField label="Storage conditions"><input v-model="form.data.storage_conditions" class="input" /></FormField>
      <div class="card space-y-4 p-4 sm:col-span-2">
        <ToggleSwitch v-model="form.data.prescription_required" label="Prescription required" description="Cannot be sold without a valid prescription" />
        <ToggleSwitch v-model="form.data.is_controlled" label="Controlled substance" description="Narcotic / psychotropic: dispensed in person only, recorded in the controlled register" />
        <ToggleSwitch v-if="isPlatform" v-model="form.data.is_active" label="Active" description="Inactive medicines can't be stocked or prescribed" />
      </div>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="emit('close')">Cancel</button>
      <button form="medicine-form" class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> {{ medicine ? 'Save' : isPlatform ? 'Add to catalogue' : 'Add medicine' }}</button>
    </template>
  </AppModal>
</template>
