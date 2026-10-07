<script setup>
import { onMounted, ref, watch } from 'vue'
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import CategoryIcon from '@/components/ui/CategoryIcon.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const meta = useMetaStore()
const ui = useUiStore()
const tab = ref('medicines')
const categories = ref([])

const { rows, meta: page, loading, filters, page: current, reload } = useList('/medicines', { search: '', category_id: '', active: '' }, { perPage: 20 })

async function loadCategories() {
  categories.value = (await api.get('/categories')).data.data
}
onMounted(() => {
  meta.load()
  loadCategories()
})

// Medicine form
const editing = ref(null)
const blank = { generic_name: '', brand_name: '', manufacturer: '', category_id: '', dosage_form: 'Tablet', strength: '', unit: 'tablet', barcode: '', prescription_required: false, is_controlled: false, storage_conditions: 'Store below 30°C', description: '', is_active: true }
const form = useForm(blank)
watch(editing, (m) => m && form.reset(m.id ? { ...blank, ...m, category_id: m.category_id ?? '' } : blank))

async function save() {
  const req = editing.value.id ? () => api.put(`/medicines/${editing.value.id}`, form.data) : () => api.post('/medicines', form.data)
  await form.submit(req, { onSuccess: () => { editing.value = null; reload() } }).catch(() => {})
}
async function remove(m) {
  if (!(await ui.confirm({ title: `Delete ${m.display_name}?`, message: 'If pharmacies stock it or doctors prescribed it, it will be deactivated instead.', confirmText: 'Delete', danger: true }))) return
  try {
    ui.success((await api.delete(`/medicines/${m.id}`)).data.message)
    reload()
  } catch (e) { ui.error(e.message) }
}

// Category form
const editingCategory = ref(null)
const catForm = useForm({ name: '', name_am: '', icon: 'pill', description: '' })
watch(editingCategory, (c) => c && catForm.reset(c.id ? { name: c.name, name_am: c.name_am ?? '', icon: c.icon ?? '', description: c.description ?? '' } : { name: '', name_am: '', icon: '', description: '' }))
async function saveCategory() {
  const req = editingCategory.value.id ? () => api.put(`/categories/${editingCategory.value.id}`, catForm.data) : () => api.post('/categories', catForm.data)
  await catForm.submit(req, { onSuccess: () => { editingCategory.value = null; loadCategories(); meta.categories = [] } }).catch(() => {})
}

const units = ['tablet', 'capsule', 'bottle', 'vial', 'tube', 'sachet', 'inhaler', 'ampoule']
const columns = [
  { key: 'name', label: 'Medicine' },
  { key: 'category', label: 'Category' },
  { key: 'flags', label: 'Rules' },
  { key: 'listings', label: 'Stocked by', align: 'center' },
  { key: 'actions', label: '', align: 'right' },
]
</script>

<template>
  <div>
    <PageHeader title="Medicine catalogue" eyebrow="Platform" subtitle="The national master list pharmacies stock from and doctors prescribe from. Based on the Ethiopian Essential Medicines List.">
      <button v-if="tab === 'medicines'" class="btn btn-primary" @click="editing = {}"><PlusIcon class="size-4" /> Add medicine</button>
      <button v-else class="btn btn-primary" @click="editingCategory = {}"><PlusIcon class="size-4" /> Add category</button>
    </PageHeader>
    <PillTabs v-model="tab" class="mb-4" :tabs="[{ value: 'medicines', label: 'Medicines', count: page.total }, { value: 'categories', label: 'Categories', count: categories.length }]" />

    <div v-if="tab === 'medicines'" class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
        <SearchInput v-model="filters.search" class="flex-1" placeholder="Generic, brand, manufacturer or barcode" />
        <select v-model="filters.category_id" class="input sm:w-56"><option value="">All categories</option><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        <select v-model="filters.active" class="input sm:w-40"><option value="">Any status</option><option value="1">Active</option><option value="0">Inactive</option></select>
      </div>
      <DataTable :columns="columns" :rows="rows" :loading="loading">
        <template #cell-name="{ row }">
          <div class="flex items-center gap-3" :class="!row.is_active && 'opacity-50'">
            <MedicineAvatar :form="row.dosage_form" size="sm" />
            <div>
              <p class="font-semibold text-slate-900">{{ row.display_name }}</p>
              <p class="text-xs text-slate-500">{{ row.dosage_form }} · {{ row.manufacturer }} · per {{ row.unit }}</p>
            </div>
          </div>
        </template>
        <template #cell-category="{ row }">{{ row.category?.name ?? '—' }}</template>
        <template #cell-flags="{ row }">
          <div class="flex flex-wrap gap-1">
            <span v-if="row.prescription_required" class="chip bg-rose-50 text-rose-700 ring-rose-600/15">Rx</span>
            <span v-else class="chip bg-emerald-50 text-emerald-700 ring-emerald-600/15">OTC</span>
            <span v-if="row.is_controlled" class="chip bg-violet-50 text-violet-700 ring-violet-600/15">Controlled</span>
            <span v-if="!row.is_active" class="chip bg-slate-100 text-slate-500 ring-slate-300">Inactive</span>
          </div>
        </template>
        <template #cell-listings="{ row }">{{ row.listings_count }}</template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1">
            <button class="btn-icon size-8" @click="editing = row"><PencilSquareIcon class="size-4" /></button>
            <button class="btn-icon size-8 hover:text-rose-600" @click="remove(row)"><TrashIcon class="size-4" /></button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="current" :meta="page" />
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button v-for="c in categories" :key="c.id" class="card card-hover flex items-center gap-4 p-5 text-left" @click="editingCategory = c">
        <span class="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><CategoryIcon :icon="c.icon" class="size-6" /></span>
        <span class="min-w-0 flex-1">
          <b class="block text-slate-900">{{ c.name }}</b>
          <span class="font-am block text-sm text-slate-500">{{ c.name_am }}</span>
        </span>
        <span class="text-sm font-bold text-slate-400">{{ c.medicines_count }}</span>
      </button>
    </div>

    <AppModal :open="!!editing" :title="editing?.id ? 'Edit medicine' : 'Add medicine'" size="lg" @close="editing = null">
      <form id="med-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <FormField label="Generic name (INN)" :error="form.errors.value.generic_name" required><input v-model="form.data.generic_name" class="input" required /></FormField>
        <FormField label="Brand name" :error="form.errors.value.brand_name"><input v-model="form.data.brand_name" class="input" /></FormField>
        <FormField label="Strength" :error="form.errors.value.strength" required><input v-model="form.data.strength" class="input" placeholder="500mg" required /></FormField>
        <FormField label="Dosage form" :error="form.errors.value.dosage_form" required>
          <select v-model="form.data.dosage_form" class="input"><option v-for="d in meta.dosageForms" :key="d">{{ d }}</option></select>
        </FormField>
        <FormField label="Dispensing unit" :error="form.errors.value.unit" required>
          <select v-model="form.data.unit" class="input"><option v-for="u in units" :key="u">{{ u }}</option></select>
        </FormField>
        <FormField label="Category" :error="form.errors.value.category_id">
          <select v-model="form.data.category_id" class="input"><option value="">—</option><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </FormField>
        <FormField label="Manufacturer"><input v-model="form.data.manufacturer" class="input" placeholder="e.g. EPHARM" /></FormField>
        <FormField label="Barcode (GTIN)" :error="form.errors.value.barcode"><input v-model="form.data.barcode" class="input font-mono" /></FormField>
        <FormField label="Storage conditions" class="sm:col-span-2"><input v-model="form.data.storage_conditions" class="input" /></FormField>
        <div class="card space-y-4 p-4 sm:col-span-2">
          <ToggleSwitch v-model="form.data.prescription_required" label="Prescription required" description="Cannot be sold without a valid prescription" />
          <ToggleSwitch v-model="form.data.is_controlled" label="Controlled substance" description="Narcotic / psychotropic: dispensed in person only" />
          <ToggleSwitch v-model="form.data.is_active" label="Active" description="Inactive medicines can't be stocked or prescribed" />
        </div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editing = null">Cancel</button>
        <button form="med-form" class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Save</button>
      </template>
    </AppModal>

    <AppModal :open="!!editingCategory" :title="editingCategory?.id ? 'Edit category' : 'New category'" size="sm" @close="editingCategory = null">
      <form id="cat-form" class="space-y-4" @submit.prevent="saveCategory">
        <FormField label="Name" :error="catForm.errors.value.name" required><input v-model="catForm.data.name" class="input" required /></FormField>
        <FormField label="Name in Amharic" label-am="ስም በአማርኛ"><input v-model="catForm.data.name_am" class="input font-am" /></FormField>
        <FormField label="Icon key" hint="pain, shield, bug, heart, drop, stomach, lungs, sparkles, hand, worm, eye, brain, baby"><input v-model="catForm.data.icon" class="input" /></FormField>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editingCategory = null">Cancel</button>
        <button form="cat-form" class="btn btn-primary" :disabled="catForm.processing.value">Save</button>
      </template>
    </AppModal>
  </div>
</template>
