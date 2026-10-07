<script setup>
import { useRouter } from 'vue-router'
import { DocumentPlusIcon } from '@heroicons/vue/24/outline'
import { useList } from '@/composables/useList'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'

const auth = useAuthStore()
const router = useRouter()
const isDoctor = auth.hasRole('doctor')
const { rows, meta, loading, filters, page } = useList('/prescriptions', { status: '', search: '', all: '' })

const columns = [
  { key: 'code', label: 'Reference' },
  { key: 'patient', label: 'Patient' },
  { key: 'doctor', label: 'Prescriber' },
  { key: 'items', label: 'Items', align: 'center' },
  { key: 'status', label: 'Status' },
  { key: 'expires', label: 'Valid until' },
]
</script>

<template>
  <div>
    <PageHeader title="Prescriptions" eyebrow="Hospital" :subtitle="isDoctor && !filters.all ? 'Prescriptions you have written.' : 'All prescriptions issued at your facility.'">
      <label v-if="isDoctor" class="flex items-center gap-2 text-sm font-semibold text-slate-600"><input v-model="filters.all" type="checkbox" true-value="1" false-value="" class="size-4 accent-brand-600" /> Whole hospital</label>
      <RouterLink v-if="auth.can('prescriptions.create')" :to="{ name: 'app.prescriptions.new' }" class="btn btn-primary"><DocumentPlusIcon class="size-4" /> Write prescription</RouterLink>
    </PageHeader>
    <div class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        <PillTabs v-model="filters.status" :tabs="[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'partially_dispensed', label: 'Partially dispensed' }, { value: 'dispensed', label: 'Dispensed' }, { value: 'expired', label: 'Expired' }, { value: 'cancelled', label: 'Cancelled' }]" />
        <SearchInput v-model="filters.search" class="lg:w-72" placeholder="Code, patient or card number" />
      </div>
      <DataTable :columns="columns" :rows="rows" :loading="loading" clickable empty-title="No prescriptions" @row-click="(p) => router.push({ name: 'app.prescription', params: { id: p.id } })">
        <template #cell-code="{ row }">
          <p class="font-mono text-sm font-bold text-slate-900">{{ row.reference_code }}</p>
          <p class="text-xs text-slate-500"><DateText :value="row.issued_at" /></p>
        </template>
        <template #cell-patient="{ row }">
          <div class="flex items-center gap-2.5">
            <UserAvatar :name="row.patient?.full_name" size="sm" />
            <div><p class="font-semibold text-slate-800">{{ row.patient?.full_name }}</p><p class="font-mono text-xs text-slate-400">{{ row.patient?.mrn }}</p></div>
          </div>
        </template>
        <template #cell-doctor="{ row }">{{ row.doctor?.name }}</template>
        <template #cell-items="{ row }">{{ row.items_count }}</template>
        <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
        <template #cell-expires="{ row }"><DateText :value="row.expires_at" /></template>
      </DataTable>
      <AppPagination v-model="page" :meta="meta" />
    </div>
  </div>
</template>
