<script setup>
import { ref, watch } from 'vue'
import { PencilSquareIcon, PlusIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money } from '@/lib/format'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const canManage = auth.can('lab.manage')
const { rows, meta, loading, filters, page, reload } = useList('/lab-tests', { search: '' }, { perPage: 50 })

const CATEGORIES = ['hematology', 'chemistry', 'parasitology', 'serology', 'urinalysis', 'microbiology', 'other']
const TYPES = [
  { value: 'numeric', label: 'Number (with reference range)' }, { value: 'select', label: 'Pick from options' },
  { value: 'positive_negative', label: 'Positive / negative' }, { value: 'text', label: 'Free text' },
]
const editing = ref(null)
const blank = {
  code: '', name: '', category: 'hematology', specimen: '', unit: '', result_type: 'numeric', options: [], optionsText: '',
  reference_low: '', reference_high: '', critical_low: '', critical_high: '', reference_text: '', price: 0, turnaround_minutes: 60, is_active: true,
}
const form = useForm(blank)
watch(editing, (t) => t && form.reset(t.id ? { ...blank, ...t, optionsText: (t.options ?? []).join('\n') } : blank))

async function save() {
  const d = { ...form.data, options: form.data.result_type === 'select' ? form.data.optionsText.split('\n').map((s) => s.trim()).filter(Boolean) : null }
  delete d.optionsText
  for (const k of ['reference_low', 'reference_high', 'critical_low', 'critical_high']) if (d[k] === '') d[k] = null
  const req = editing.value.id ? () => api.put(`/lab-tests/${editing.value.id}`, d) : () => api.post('/lab-tests', d)
  await form.submit(req, { onSuccess: () => { editing.value = null; reload() } }).catch(() => {})
}

const columns = [
  { key: 'code', label: 'Code' }, { key: 'name', label: 'Test' }, { key: 'category', label: 'Section' },
  { key: 'reference', label: 'Reference' }, { key: 'critical', label: 'Critical' }, { key: 'price', label: 'Price', align: 'right' },
  { key: 'actions', label: '', align: 'right' },
]
</script>

<template>
  <div>
    <PageHeader title="Lab test menu" eyebrow="Laboratory" subtitle="Tests the lab offers, their reference and critical ranges (used to flag results) and prices billed to patients.">
      <button v-if="canManage" class="btn btn-primary" @click="editing = {}"><PlusIcon class="size-4" /> Add test</button>
    </PageHeader>
    <div class="card overflow-hidden">
      <div class="border-b border-slate-100 p-4"><SearchInput v-model="filters.search" placeholder="Search tests" /></div>
      <DataTable :columns="columns" :rows="rows" :loading="loading" empty-title="No tests configured">
        <template #cell-code="{ row }"><span class="font-mono text-xs font-bold">{{ row.code }}</span></template>
        <template #cell-name="{ row }"><p class="font-semibold" :class="!row.is_active && 'text-slate-400 line-through'">{{ row.name }}</p><p class="text-xs text-slate-500">{{ row.specimen }}</p></template>
        <template #cell-category="{ row }"><span class="capitalize">{{ row.category }}</span></template>
        <template #cell-reference="{ row }"><span class="text-xs">{{ row.reference || '—' }}</span></template>
        <template #cell-critical="{ row }"><span class="text-xs text-rose-600">{{ [row.critical_low != null && `≤ ${row.critical_low}`, row.critical_high != null && `≥ ${row.critical_high}`].filter(Boolean).join(' / ') || '—' }}</span></template>
        <template #cell-price="{ row }"><b>{{ money(row.price) }}</b></template>
        <template #cell-actions="{ row }"><button v-if="canManage" class="btn-icon size-8" @click="editing = row"><PencilSquareIcon class="size-4" /></button></template>
      </DataTable>
      <AppPagination v-model="page" :meta="meta" />
    </div>

    <AppModal :open="!!editing" :title="editing?.id ? 'Edit test' : 'New lab test'" size="lg" @close="editing = null">
      <form id="test-form" class="grid gap-4 sm:grid-cols-3" @submit.prevent="save">
        <FormField label="Code" :error="form.errors.value.code" required><input v-model="form.data.code" class="input font-mono uppercase" required /></FormField>
        <FormField label="Name" class="sm:col-span-2" :error="form.errors.value.name" required><input v-model="form.data.name" class="input" required /></FormField>
        <FormField label="Section"><select v-model="form.data.category" class="input capitalize"><option v-for="c in CATEGORIES" :key="c">{{ c }}</option></select></FormField>
        <FormField label="Specimen"><input v-model="form.data.specimen" class="input" placeholder="Serum, whole blood…" /></FormField>
        <FormField label="Price (ETB)" :error="form.errors.value.price" required><input v-model="form.data.price" type="number" min="0" step="0.5" class="input" /></FormField>
        <FormField label="Result type" class="sm:col-span-2"><select v-model="form.data.result_type" class="input"><option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option></select></FormField>
        <FormField label="Turnaround (min)"><input v-model="form.data.turnaround_minutes" type="number" min="5" class="input" /></FormField>
        <template v-if="form.data.result_type === 'numeric'">
          <FormField label="Unit"><input v-model="form.data.unit" class="input" placeholder="mg/dL" /></FormField>
          <FormField label="Normal low"><input v-model="form.data.reference_low" type="number" step="any" class="input" /></FormField>
          <FormField label="Normal high" :error="form.errors.value.reference_high"><input v-model="form.data.reference_high" type="number" step="any" class="input" /></FormField>
          <FormField label="Critical low" hint="Alerts the doctor"><input v-model="form.data.critical_low" type="number" step="any" class="input" /></FormField>
          <FormField label="Critical high" hint="Alerts the doctor"><input v-model="form.data.critical_high" type="number" step="any" class="input" /></FormField>
        </template>
        <FormField v-if="form.data.result_type === 'select'" label="Options (one per line, normal first)" class="sm:col-span-3"><textarea v-model="form.data.optionsText" rows="4" class="input" /></FormField>
        <FormField v-if="form.data.result_type !== 'numeric'" label="Normal result text" class="sm:col-span-2"><input v-model="form.data.reference_text" class="input" placeholder="e.g. Negative" /></FormField>
        <FormField label="Offered"><ToggleSwitch v-model="form.data.is_active" /></FormField>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editing = null">Cancel</button>
        <button form="test-form" class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Save test</button>
      </template>
    </AppModal>
  </div>
</template>
