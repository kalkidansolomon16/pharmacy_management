<script setup>
/** Nurse triage: vital signs. The server computes BMI and danger-sign alerts and can raise the priority. */
import { computed, watch } from 'vue'
import api from '@/lib/api'
import { useForm } from '@/composables/useForm'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const props = defineProps({ visit: { type: Object, default: null } })
const emit = defineEmits(['close', 'saved'])

const blank = { temperature: '', pulse: '', respiratory_rate: '', bp_systolic: '', bp_diastolic: '', spo2: '', weight: '', height: '', muac: '' }
const form = useForm(blank)
watch(() => props.visit, (v) => v && form.reset({ ...blank, ...(v.vitals ?? {}) }))

const fields = [
  { key: 'temperature', label: 'Temperature', unit: '°C', step: '0.1' },
  { key: 'pulse', label: 'Pulse', unit: '/min' },
  { key: 'respiratory_rate', label: 'Resp. rate', unit: '/min' },
  { key: 'spo2', label: 'SpO₂', unit: '%' },
  { key: 'bp_systolic', label: 'BP systolic', unit: 'mmHg' },
  { key: 'bp_diastolic', label: 'BP diastolic', unit: 'mmHg' },
  { key: 'weight', label: 'Weight', unit: 'kg', step: '0.1' },
  { key: 'height', label: 'Height', unit: 'cm', step: '0.1' },
  { key: 'muac', label: 'MUAC', unit: 'cm', step: '0.1' },
]

/** Live hints so the nurse sees danger signs while typing (the server applies the same rules). */
const warnings = computed(() => {
  const d = form.data
  const w = []
  if (Number(d.temperature) >= 37.5) w.push(Number(d.temperature) >= 39.5 ? 'High fever' : 'Fever')
  if (Number(d.bp_systolic) >= 140 || Number(d.bp_diastolic) >= 90) w.push('Raised blood pressure')
  if (d.spo2 !== '' && Number(d.spo2) < 92) w.push('Low oxygen saturation')
  if (Number(d.pulse) > 100) w.push('Tachycardia')
  if (d.muac !== '' && Number(d.muac) < 11.5) w.push('Severe acute malnutrition (MUAC)')
  return w
})

async function save() {
  const payload = Object.fromEntries(Object.entries(form.data).filter(([, v]) => v !== '' && v !== null))
  await form.submit(() => api.post(`/visits/${props.visit.id}/triage`, payload), {
    onSuccess: (res) => emit('saved', res.data),
  }).catch(() => {})
}
</script>

<template>
  <AppModal :open="!!visit" title="Vital signs" :subtitle="visit ? `${visit.patient?.full_name} · ${visit.visit_number}` : ''" @close="emit('close')">
    <form id="triage-form" class="grid grid-cols-2 gap-3 sm:grid-cols-3" @submit.prevent="save">
      <FormField v-for="f in fields" :key="f.key" :label="`${f.label} (${f.unit})`" :error="form.errors.value[f.key]">
        <input v-model="form.data[f.key]" type="number" :step="f.step ?? '1'" class="input" />
      </FormField>
    </form>
    <div v-if="warnings.length" class="mt-4 flex flex-wrap gap-1.5">
      <span v-for="w in warnings" :key="w" class="chip bg-rose-50 text-rose-700 ring-rose-600/15">⚠ {{ w }}</span>
    </div>
    <template #footer>
      <button class="btn btn-secondary" @click="emit('close')">Cancel</button>
      <button form="triage-form" class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Save vitals</button>
    </template>
  </AppModal>
</template>
