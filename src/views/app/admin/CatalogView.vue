<script setup>
/**
 * Medicine catalogue.
 * Platform team: the national master list plus a review queue for medicines/categories pharmacies added.
 * Pharmacies & hospitals with "Add medicines & categories": the shared list plus their own additions.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { CheckIcon, ClockIcon, PencilSquareIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import CategoryIcon from '@/components/ui/CategoryIcon.vue'
import MedicineFormModal from '@/components/inventory/MedicineFormModal.vue'

const auth = useAuthStore()
const meta = useMetaStore()
const ui = useUiStore()
const isPlatform = computed(() => auth.can('catalog.manage'))
const canAdd = computed(() => isPlatform.value || auth.can('catalog.contribute'))

const tab = ref('medicines')
const categories = ref([])
const { rows, meta: page, loading, filters, page: current, reload } = useList('/medicines', { search: '', category_id: '', active: '', review: '', mine: '' }, { perPage: 20 })

async function loadCategories() {
  categories.value = (await api.get('/categories')).data.data
}
onMounted(() => {
  meta.load()
  loadCategories()
})
const pendingCategories = computed(() => categories.value.filter((c) => c.review_status === 'pending').length)

// Medicine form (shared component)
const editing = ref(null) // {} = new
function medicineSaved() {
  editing.value = null
  reload()
}
async function remove(m) {
  if (!(await ui.confirm({ title: `Delete ${m.display_name}?`, message: 'If it is stocked or was prescribed, it will be deactivated instead.', confirmText: 'Delete', danger: true }))) return
  try {
    ui.success((await api.delete(`/medicines/${m.id}`)).data.message)
    reload()
  } catch (e) { ui.error(e.message) }
}

// Platform review
async function review(kind, item, approve) {
  let note = null
  if (!approve) {
    note = await ui.confirm({
      title: `Reject “${item.display_name ?? item.name}”?`,
      message: 'The organization that added it can keep using it, correct it and resubmit.',
      confirmText: 'Reject', danger: true, input: { label: 'Reason (shown to the pharmacy)', required: true },
    })
    if (!note) return
  }
  try {
    const { data } = await api.post(`/admin/catalog/${kind}/${item.id}/review`, { decision: approve ? 'approve' : 'reject', note })
    ui.success(data.message)
    kind === 'medicines' ? reload() : loadCategories()
    if (kind === 'medicines') loadCategories()
  } catch (e) { ui.error(e.message) }
}

// Category form
const editingCategory = ref(null)
const catForm = useForm({ name: '', name_am: '', icon: '', description: '' })
watch(editingCategory, (c) => c && catForm.reset(c.id ? { name: c.name, name_am: c.name_am ?? '', icon: c.icon ?? '', description: c.description ?? '' } : { name: '', name_am: '', icon: '', description: '' }))
async function saveCategory() {
  const req = editingCategory.value.id ? () => api.put(`/categories/${editingCategory.value.id}`, catForm.data) : () => api.post('/categories', catForm.data)
  await catForm.submit(req, { onSuccess: () => { editingCategory.value = null; loadCategories(); meta.categories = [] } }).catch(() => {})
}

const statusChip = {
  pending: ['bg-amber-50 text-amber-700 ring-amber-600/20', 'Awaiting review'],
  rejected: ['bg-rose-50 text-rose-700 ring-rose-600/15', 'Not approved'],
}
const columns = computed(() => [
  { key: 'name', label: 'Medicine' },
  { key: 'category', label: 'Category' },
  { key: 'flags', label: 'Rules' },
  { key: 'listings', label: 'Stocked by', align: 'center' },
  { key: 'actions', label: '', align: 'right' },
])
const reviewTabs = computed(() => (isPlatform.value
  ? [{ value: '', label: 'All' }, { value: 'pending', label: 'Awaiting review' }, { value: 'rejected', label: 'Not approved' }]
  : [{ value: '', label: 'All medicines' }, { value: 'mine', label: 'Added by us' }]))
const reviewTab = computed({
  get: () => (filters.mine ? 'mine' : filters.review),
  set: (v) => Object.assign(filters, v === 'mine' ? { mine: '1', review: '' } : { mine: '', review: v }),
})
</script>

<template>
  <div>
    <PageHeader
      title="Medicine catalogue"
      :eyebrow="isPlatform ? 'Platform' : 'Stock & supply'"
      :subtitle="isPlatform
        ? 'The national master list pharmacies stock from and doctors prescribe from. Review what pharmacies add before it is shared.'
        : 'The shared list you stock from. Missing something? Add it: you can use it at once, and the MedLink team reviews it before it is shared with others.'"
    >
      <template v-if="canAdd">
        <button v-if="tab === 'medicines'" class="btn btn-primary" @click="editing = {}"><PlusIcon class="size-4" /> Add medicine</button>
        <button v-else class="btn btn-primary" @click="editingCategory = {}"><PlusIcon class="size-4" /> Add category</button>
      </template>
    </PageHeader>
    <PillTabs v-model="tab" class="mb-4" :tabs="[{ value: 'medicines', label: 'Medicines', count: page.total }, { value: 'categories', label: 'Categories', count: categories.length }]" />

    <div v-if="tab === 'medicines'" class="card overflow-hidden">
      <div class="space-y-3 border-b border-slate-100 p-4">
        <PillTabs v-model="reviewTab" :tabs="reviewTabs" />
        <div class="flex flex-col gap-3 sm:flex-row">
          <SearchInput v-model="filters.search" class="flex-1" placeholder="Generic, brand, manufacturer or barcode" />
          <select v-model="filters.category_id" class="input sm:w-56"><option value="">All categories</option><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option></select>
          <select v-if="isPlatform" v-model="filters.active" class="input sm:w-40"><option value="">Any status</option><option value="1">Active</option><option value="0">Inactive</option></select>
        </div>
      </div>
      <DataTable :columns="columns" :rows="rows" :loading="loading" :empty-title="reviewTab === 'pending' ? 'Nothing waiting for review' : 'No medicines match'">
        <template #cell-name="{ row }">
          <div class="flex items-center gap-3" :class="!row.is_active && 'opacity-50'">
            <MedicineAvatar :form="row.dosage_form" size="sm" />
            <div class="min-w-0">
              <p class="font-semibold text-slate-900">{{ row.display_name }}</p>
              <p class="text-xs text-slate-500">{{ row.dosage_form }}<template v-if="row.manufacturer"> · {{ row.manufacturer }}</template> · per {{ row.unit }}</p>
              <p v-if="row.contributed_by" class="text-xs font-semibold text-sky-700">Added by {{ row.contributed_by }}</p>
              <p v-else-if="row.is_own" class="text-xs font-semibold text-sky-700">Added by your organization</p>
              <p v-if="row.review_note" class="text-xs text-rose-600">{{ row.review_note }}</p>
            </div>
          </div>
        </template>
        <template #cell-category="{ row }">{{ row.category?.name ?? '—' }}</template>
        <template #cell-flags="{ row }">
          <div class="flex flex-wrap gap-1">
            <span v-if="statusChip[row.review_status]" class="chip" :class="statusChip[row.review_status][0]"><ClockIcon v-if="row.review_status === 'pending'" class="size-3.5" /> {{ statusChip[row.review_status][1] }}</span>
            <span v-if="row.prescription_required" class="chip bg-rose-50 text-rose-700 ring-rose-600/15">Rx</span>
            <span v-else class="chip bg-emerald-50 text-emerald-700 ring-emerald-600/15">OTC</span>
            <span v-if="row.is_controlled" class="chip bg-violet-50 text-violet-700 ring-violet-600/15">Controlled</span>
            <span v-if="!row.is_active" class="chip bg-slate-100 text-slate-500 ring-slate-300">Inactive</span>
          </div>
        </template>
        <template #cell-listings="{ row }">{{ row.listings_count }}</template>
        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-1">
            <template v-if="isPlatform && row.review_status === 'pending'">
              <button class="btn btn-ghost btn-sm text-rose-600" @click="review('medicines', row, false)"><XMarkIcon class="size-4" /> Reject</button>
              <button class="btn btn-primary btn-sm" @click="review('medicines', row, true)"><CheckIcon class="size-4" /> Approve</button>
            </template>
            <button v-if="row.can_edit" class="btn-icon size-8" title="Edit" @click="editing = row"><PencilSquareIcon class="size-4" /></button>
            <button v-if="row.can_edit" class="btn-icon size-8 hover:text-rose-600" title="Delete" @click="remove(row)"><TrashIcon class="size-4" /></button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="current" :meta="page" />
    </div>

    <div v-else>
      <p v-if="isPlatform && pendingCategories" class="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{{ pendingCategories }} categor{{ pendingCategories === 1 ? 'y' : 'ies' }} awaiting review</p>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="c in categories" :key="c.id" class="card flex items-center gap-4 p-5">
          <span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><CategoryIcon :icon="c.icon" class="size-6" /></span>
          <span class="min-w-0 flex-1">
            <b class="block truncate text-slate-900">{{ c.name }}</b>
            <span class="font-am block text-sm text-slate-500">{{ c.name_am }}</span>
            <span v-if="statusChip[c.review_status]" class="chip mt-1" :class="statusChip[c.review_status][0]">{{ statusChip[c.review_status][1] }}</span>
            <span v-if="c.contributed_by" class="block text-xs text-sky-700">Added by {{ c.contributed_by }}</span>
            <span v-if="c.review_note" class="block text-xs text-rose-600">{{ c.review_note }}</span>
          </span>
          <span class="flex flex-col items-end gap-1">
            <span class="text-sm font-bold text-slate-400">{{ c.medicines_count }}</span>
            <span v-if="isPlatform && c.review_status === 'pending'" class="flex gap-1">
              <button class="btn-icon size-8 hover:text-rose-600" title="Reject" @click="review('categories', c, false)"><XMarkIcon class="size-4" /></button>
              <button class="btn-icon size-8 text-brand-700" title="Approve" @click="review('categories', c, true)"><CheckIcon class="size-4" /></button>
            </span>
            <button v-if="c.can_edit" class="btn-icon size-8" title="Edit" @click="editingCategory = c"><PencilSquareIcon class="size-4" /></button>
          </span>
        </div>
      </div>
    </div>

    <MedicineFormModal :open="!!editing" :medicine="editing?.id ? editing : null" @close="editing = null" @saved="medicineSaved" />

    <AppModal :open="!!editingCategory" :title="editingCategory?.id ? 'Edit category' : 'New category'" size="sm" @close="editingCategory = null">
      <p v-if="!isPlatform" class="mb-4 text-sm text-slate-500">Your pharmacy can use it at once; it is shared with others after review.</p>
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
