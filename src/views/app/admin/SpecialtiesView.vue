<script setup>
import { computed, onMounted, ref } from 'vue'
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { useForm } from '@/composables/useForm'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import SearchInput from '@/components/ui/SearchInput.vue'

/**
 * Platform team: the list of hospital specialties (Orthopedics & Spine, Cardiology...).
 * Hospitals choose from this list; patients filter and book by it on the website and the app.
 */
const ui = useUiStore()
const rows = ref([])
const loading = ref(true)
const search = ref('')

async function load() {
  loading.value = true
  try {
    rows.value = (await api.get('/admin/specialties')).data.data
  } finally {
    loading.value = false
  }
}
onMounted(load)

const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? rows.value.filter((r) => `${r.name} ${r.name_am ?? ''}`.toLowerCase().includes(q)) : rows.value
})

const editing = ref(null)
const blank = { name: '', name_am: '', description: '', is_active: true, sort_order: 100 }
const form = useForm(blank)
function open(row) {
  editing.value = row ?? {}
  form.reset(row ? { ...blank, ...row } : { ...blank, sort_order: (rows.value.at(-1)?.sort_order ?? 0) + 10 })
}
async function save() {
  const req = editing.value.id ? () => api.put(`/admin/specialties/${editing.value.id}`, form.data) : () => api.post('/admin/specialties', form.data)
  await form.submit(req, { onSuccess: () => { editing.value = null; load() } }).catch(() => {})
}
async function toggle(row) {
  try {
    await api.put(`/admin/specialties/${row.id}`, { ...row, is_active: !row.is_active })
    ui.success(row.is_active ? `“${row.name}” switched off - patients no longer see it.` : `“${row.name}” switched on.`)
    load()
  } catch (e) {
    ui.error(e.message)
  }
}
async function remove(row) {
  if (!(await ui.confirm({ title: `Delete “${row.name}”?`, message: 'This cannot be undone.', confirmText: 'Delete', danger: true }))) return
  try {
    await api.delete(`/admin/specialties/${row.id}`)
    ui.success('Specialty deleted.')
    load()
  } catch (e) {
    ui.error(e.message)
  }
}
</script>

<template>
  <div>
    <PageHeader title="Hospital specialties" eyebrow="Platform" subtitle="The specialties hospitals and clinics choose from (e.g. Orthopedics & Spine). Patients filter nearby hospitals and book appointments by them.">
      <button class="btn btn-primary" @click="open(null)"><PlusIcon class="size-4" /> Add specialty</button>
    </PageHeader>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <SearchInput v-model="search" placeholder="Search specialties" class="w-72" />
      <p class="text-sm text-slate-500">{{ rows.filter((r) => r.is_active).length }} active · {{ rows.length }} in total</p>
    </div>

    <div v-if="loading && !rows.length" class="skeleton h-64 rounded-2xl" />
    <div v-else class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
          <tr><th class="px-4 py-3">Specialty</th><th class="px-4 py-3">Hospitals</th><th class="px-4 py-3">Order</th><th class="px-4 py-3">Shown to patients</th><th class="px-4 py-3" /></tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="r in shown" :key="r.id" :class="!r.is_active && 'bg-slate-50/60 text-slate-400'">
            <td class="px-4 py-3">
              <p class="font-semibold" :class="r.is_active ? 'text-slate-900' : 'line-through'">{{ r.name }}</p>
              <p v-if="r.name_am" class="font-am text-xs text-slate-500">{{ r.name_am }}</p>
              <p v-if="r.description" class="text-xs text-slate-500">{{ r.description }}</p>
            </td>
            <td class="px-4 py-3 font-semibold">{{ r.hospitals_count }}</td>
            <td class="px-4 py-3 text-slate-500">{{ r.sort_order }}</td>
            <td class="px-4 py-3"><ToggleSwitch :model-value="r.is_active" @update:model-value="toggle(r)" /></td>
            <td class="px-4 py-3 text-right">
              <button class="btn-icon size-8" title="Edit" @click="open(r)"><PencilSquareIcon class="size-4" /></button>
              <button v-if="!r.hospitals_count" class="btn-icon size-8 text-rose-600" title="Delete" @click="remove(r)"><TrashIcon class="size-4" /></button>
            </td>
          </tr>
          <tr v-if="!shown.length"><td colspan="5" class="px-4 py-10 text-center text-slate-400">No specialty matches.</td></tr>
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-slate-500">A specialty used by hospitals cannot be deleted - switch it off instead; hospitals keep it but patients no longer see it.</p>

    <AppModal :open="!!editing" :title="editing?.id ? 'Edit specialty' : 'New specialty'" @close="editing = null">
      <form id="specialty-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <FormField label="Name (English)" class="sm:col-span-2" :error="form.errors.value.name" required>
          <input v-model="form.data.name" class="input" placeholder="e.g. Orthopedics & Spine" required />
        </FormField>
        <FormField label="Name (Amharic)" :error="form.errors.value.name_am"><input v-model="form.data.name_am" class="input font-am" placeholder="የአጥንትና የአከርካሪ" /></FormField>
        <FormField label="Order in lists" hint="Smaller numbers come first" :error="form.errors.value.sort_order"><input v-model.number="form.data.sort_order" type="number" min="0" max="1000" class="input" /></FormField>
        <FormField label="Short description (optional)" class="sm:col-span-2" :error="form.errors.value.description">
          <input v-model="form.data.description" class="input" placeholder="e.g. Bones, joints, back and neck problems" />
        </FormField>
        <FormField label="Shown to patients" class="sm:col-span-2"><ToggleSwitch v-model="form.data.is_active" /></FormField>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editing = null">Cancel</button>
        <button form="specialty-form" class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Save</button>
      </template>
    </AppModal>
  </div>
</template>
