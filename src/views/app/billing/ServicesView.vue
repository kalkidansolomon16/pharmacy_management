<script setup>
import { computed, ref, watch } from 'vue'
import { PencilSquareIcon, PlusIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money } from '@/lib/format'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const auth = useAuthStore()
const canCreate = auth.can('services.create')
const canEdit = auth.can('services.update')
const { rows, loading, reload } = useList('/services', {}, { perPage: 200, syncQuery: false })
const CATEGORIES = ['registration', 'consultation', 'procedure', 'bed', 'other']
const grouped = computed(() => CATEGORIES.map((c) => ({ c, items: rows.value.filter((r) => r.category === c) })).filter((g) => g.items.length))

const editing = ref(null)
const blank = { code: '', name: '', category: 'procedure', price: 0, tax_category: 'exempt', is_active: true }
const form = useForm(blank)
watch(editing, (s) => s && form.reset(s.id ? { ...blank, ...s } : blank))
async function save() {
  const req = editing.value.id ? () => api.put(`/services/${editing.value.id}`, form.data) : () => api.post('/services', form.data)
  await form.submit(req, { onSuccess: () => { editing.value = null; reload() } }).catch(() => {})
}
const columns = [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Service' }, { key: 'tax', label: 'Tax' }, { key: 'price', label: 'Price', align: 'right' }, { key: 'actions', label: '', align: 'right' }]
</script>

<template>
  <div>
    <PageHeader title="Service price list" eyebrow="Billing" subtitle="Card, consultation, procedure and bed charges. REG and CONS-* codes are billed automatically at check-in.">
      <button v-if="canCreate" class="btn btn-primary" @click="editing = {}"><PlusIcon class="size-4" /> Add service</button>
    </PageHeader>
    <div v-if="loading && !rows.length" class="skeleton h-64 rounded-2xl" />
    <div v-for="g in grouped" :key="g.c" class="card mb-5 overflow-hidden">
      <h2 class="border-b border-slate-100 px-5 py-3 font-bold capitalize text-slate-900">{{ g.c }}</h2>
      <DataTable :columns="columns" :rows="g.items">
        <template #cell-code="{ row }"><span class="font-mono text-xs font-bold">{{ row.code }}</span></template>
        <template #cell-name="{ row }"><span :class="!row.is_active && 'text-slate-400 line-through'">{{ row.name }}</span></template>
        <template #cell-tax="{ row }"><StatusBadge :status="row.tax_category === 'standard' ? 'warning' : 'ok'" :label="row.tax_category === 'standard' ? 'VAT/TOT' : 'Exempt'" :dot="false" /></template>
        <template #cell-price="{ row }"><b>{{ money(row.price) }}</b></template>
        <template #cell-actions="{ row }"><button v-if="canEdit" class="btn-icon size-8" @click="editing = row"><PencilSquareIcon class="size-4" /></button></template>
      </DataTable>
    </div>
    <AppModal :open="!!editing" :title="editing?.id ? 'Edit service' : 'New service'" @close="editing = null">
      <form id="svc-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <FormField label="Code" :error="form.errors.value.code" required><input v-model="form.data.code" class="input font-mono uppercase" required /></FormField>
        <FormField label="Category"><select v-model="form.data.category" class="input capitalize"><option v-for="c in CATEGORIES" :key="c">{{ c }}</option></select></FormField>
        <FormField label="Name" class="sm:col-span-2" :error="form.errors.value.name" required><input v-model="form.data.name" class="input" required /></FormField>
        <FormField label="Price (ETB)" :error="form.errors.value.price" required><input v-model="form.data.price" type="number" min="0" step="0.5" class="input" /></FormField>
        <FormField label="Tax" hint="Most health services are VAT-exempt">
          <select v-model="form.data.tax_category" class="input"><option value="exempt">Exempt</option><option value="standard">Taxable (VAT / TOT)</option></select>
        </FormField>
        <FormField label="Active"><ToggleSwitch v-model="form.data.is_active" /></FormField>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editing = null">Cancel</button>
        <button form="svc-form" class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Save</button>
      </template>
    </AppModal>
  </div>
</template>
