<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { NoSymbolIcon, PencilSquareIcon, UserPlusIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { phone } from '@/lib/format'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { ROLE_LABELS, useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import DateText from '@/components/ui/DateText.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const ui = useUiStore()
const { rows, meta, loading, filters, page, reload } = useList('/users', { search: '', role: '', status: '', tenant_id: '' })

const tenants = ref([])
onMounted(async () => {
  if (auth.isSuperAdmin) tenants.value = (await api.get('/admin/tenants', { params: { per_page: 100, status: 'active' } })).data.data
})

const editing = ref(null)
const form = useForm({})
const roleOptions = computed(() => {
  if (!auth.isSuperAdmin) return auth.tenantType === 'pharmacy' ? ['pharmacy_admin', 'staff'] : ['hospital_admin', 'doctor']
  const type = tenants.value.find((t) => t.id === Number(form.data.tenant_id))?.type
  return type === 'pharmacy' ? ['pharmacy_admin', 'staff'] : type === 'hospital' ? ['hospital_admin', 'doctor'] : ['super_admin']
})
watch(editing, (u) => u && form.reset({
  name: u.name ?? '', email: u.email ?? '', phone: u.phone ? phone(u.phone) : '', role: u.role ?? (auth.tenantType === 'hospital' ? 'doctor' : 'staff'),
  status: u.status ?? 'active', license_number: u.license_number ?? '', tenant_id: u.tenant_id ?? '', password: '',
}))
watch(() => form.data.tenant_id, () => {
  if (form.data.role && !roleOptions.value.includes(form.data.role)) form.data.role = roleOptions.value.at(-1)
})

async function save() {
  const req = editing.value.id ? () => api.put(`/users/${editing.value.id}`, form.data) : () => api.post('/users', form.data)
  await form.submit(req, { onSuccess: () => { editing.value = null; reload() } }).catch(() => {})
}

async function deactivate(user) {
  if (!(await ui.confirm({ title: `Deactivate ${user.name}?`, message: 'They are signed out immediately and can no longer sign in. Their history is kept.', confirmText: 'Deactivate', danger: true }))) return
  try {
    ui.success((await api.delete(`/users/${user.id}`)).data.message)
    reload()
  } catch (e) { ui.error(e.message) }
}

const columns = [
  { key: 'name', label: 'Member' },
  { key: 'role', label: 'Role' },
  ...(auth.isSuperAdmin ? [{ key: 'tenant', label: 'Organization' }] : []),
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'last', label: 'Last sign-in' },
  { key: 'actions', label: '', align: 'right' },
]
</script>

<template>
  <div>
    <PageHeader title="Team" :eyebrow="auth.tenant?.name ?? 'Platform'" subtitle="Who can access your workspace, and what they can do.">
      <button class="btn btn-primary" @click="editing = {}"><UserPlusIcon class="size-4" /> Add member</button>
    </PageHeader>
    <div class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
        <SearchInput v-model="filters.search" class="flex-1" placeholder="Name, email or phone" />
        <select v-model="filters.role" class="input sm:w-48"><option value="">All roles</option><option v-for="(l, r) in ROLE_LABELS" :key="r" :value="r">{{ l }}</option></select>
        <select v-model="filters.status" class="input sm:w-40"><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select>
      </div>
      <DataTable :columns="columns" :rows="rows" :loading="loading">
        <template #cell-name="{ row }">
          <div class="flex items-center gap-3">
            <UserAvatar :name="row.name" size="sm" />
            <div><p class="font-semibold text-slate-900">{{ row.name }} <span v-if="row.id === auth.user?.id" class="text-xs font-normal text-brand-600">(you)</span></p><p class="text-xs text-slate-500">{{ row.email }}</p></div>
          </div>
        </template>
        <template #cell-role="{ row }">
          <span class="chip bg-slate-100 text-slate-700 ring-slate-200">{{ ROLE_LABELS[row.role] ?? row.role }}</span>
          <p v-if="row.license_number" class="mt-0.5 font-mono text-[0.7rem] text-slate-400">{{ row.license_number }}</p>
        </template>
        <template #cell-tenant="{ row }"><span class="text-sm">{{ row.tenant?.name ?? '—' }}</span></template>
        <template #cell-phone="{ row }">{{ phone(row.phone) }}</template>
        <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
        <template #cell-last="{ row }"><span class="text-xs text-slate-500"><DateText :value="row.last_login_at" relative /></span></template>
        <template #cell-actions="{ row }">
          <div v-if="row.id !== auth.user?.id && row.role !== 'super_admin'" class="flex justify-end gap-1">
            <button class="btn-icon size-8" @click="editing = row"><PencilSquareIcon class="size-4" /></button>
            <button v-if="row.status === 'active'" class="btn-icon size-8 hover:text-rose-600" title="Deactivate" @click="deactivate(row)"><NoSymbolIcon class="size-4" /></button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="page" :meta="meta" />
    </div>

    <AppModal :open="!!editing" :title="editing?.id ? 'Edit member' : 'Add team member'" @close="editing = null">
      <form id="user-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <FormField v-if="auth.isSuperAdmin && !editing?.id" label="Organization" class="sm:col-span-2" :error="form.errors.value.tenant_id">
          <select v-model="form.data.tenant_id" class="input"><option value="">— Platform (super admin) —</option><option v-for="t in tenants" :key="t.id" :value="t.id">{{ t.name }} ({{ t.type }})</option></select>
        </FormField>
        <FormField label="Full name" :error="form.errors.value.name" required><input v-model="form.data.name" class="input" required /></FormField>
        <FormField label="Email" :error="form.errors.value.email" required><input v-model="form.data.email" type="email" class="input" required /></FormField>
        <FormField label="Mobile" :error="form.errors.value.phone"><input v-model="form.data.phone" type="tel" class="input" placeholder="09XX XXX XXX" /></FormField>
        <FormField label="Role" :error="form.errors.value.role" required>
          <select v-model="form.data.role" class="input"><option v-for="r in roleOptions" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option></select>
        </FormField>
        <FormField v-if="['doctor', 'staff', 'pharmacy_admin'].includes(form.data.role)" :label="form.data.role === 'doctor' ? 'Medical licence no.' : 'Pharmacist licence no.'" :error="form.errors.value.license_number">
          <input v-model="form.data.license_number" class="input font-mono" placeholder="e.g. EMA-MD-11823" />
        </FormField>
        <FormField v-if="editing?.id" label="Status">
          <select v-model="form.data.status" class="input"><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select>
        </FormField>
        <FormField :label="editing?.id ? 'New password (optional)' : 'Temporary password'" :error="form.errors.value.password" hint="8+ chars with upper, lower case and a number" :required="!editing?.id">
          <input v-model="form.data.password" type="password" class="input" autocomplete="new-password" :required="!editing?.id" />
        </FormField>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editing = null">Cancel</button>
        <button form="user-form" class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Save</button>
      </template>
    </AppModal>
  </div>
</template>
