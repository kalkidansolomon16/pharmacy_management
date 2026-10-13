<script setup>
import { ref } from 'vue'
import { BuildingOffice2Icon, BuildingStorefrontIcon, CheckIcon, MapPinIcon, NoSymbolIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { phone, titleCase } from '@/lib/format'
import { useList } from '@/composables/useList'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import AppModal from '@/components/ui/AppModal.vue'

const ui = useUiStore()
const { rows, meta, loading, filters, page, reload } = useList('/admin/tenants', { status: '', type: '', search: '' })
const selected = ref(null)

/** Without a map pin, an organization does not appear in "near me" searches or on the map. */
const hasPin = (t) => t?.latitude != null && t?.longitude != null
const mapLink = (t) => `https://www.google.com/maps/search/?api=1&query=${t.latitude},${t.longitude}`

async function setStatus(tenant, status) {
  const verbs = { active: 'Approve', suspended: 'Suspend', rejected: 'Reject', pending: 'Move to pending' }
  const ok = await ui.confirm({
    title: `${verbs[status]} ${tenant.name}?`,
    message: status === 'active'
      ? `Confirm licence ${tenant.license_number} is valid. The ${tenant.type} goes live immediately and its team is notified.`
        + (hasPin(tenant) ? '' : `

⚠ No map location yet: it won't appear in "near me" searches until its admin sets the pin (they'll see a reminder on their dashboard).`)
      : `All ${tenant.users_count ?? ''} users of this organization lose access to their workspace.`,
    confirmText: verbs[status],
    danger: status !== 'active',
    // The organization is told why, in the app and by email
    input: status === 'rejected'
      ? { label: 'Reason (sent to the applicant)', placeholder: 'e.g. Licence number not found in the EFDA register', required: true }
      : status === 'suspended' ? { label: 'Reason (optional, sent to the organization)', placeholder: 'e.g. Subscription unpaid for 2 months' } : undefined,
  })
  if (!ok) return
  try {
    const reason = typeof ok === 'string' ? ok : undefined
    const { data } = await api.patch(`/admin/tenants/${tenant.id}/status`, { status, reason })
    ui.success(data.message)
    selected.value = null
    reload()
  } catch (e) {
    ui.error(e.message)
  }
}

const columns = [
  { key: 'name', label: 'Organization' },
  { key: 'licence', label: 'Licence / TIN' },
  { key: 'location', label: 'Location' },
  { key: 'users', label: 'Users', align: 'center' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' },
]
</script>

<template>
  <div>
    <PageHeader title="Organizations" eyebrow="Platform" subtitle="Verify licences, approve new pharmacies and hospitals, and suspend bad actors." />
    <div class="card overflow-hidden">
      <div class="space-y-4 border-b border-slate-100 p-4">
        <PillTabs v-model="filters.status" :tabs="[{ value: '', label: 'All' }, { value: 'pending', label: 'Awaiting verification' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'rejected', label: 'Rejected' }]" />
        <div class="flex flex-col gap-3 sm:flex-row">
          <SearchInput v-model="filters.search" class="flex-1" placeholder="Name, licence number or city" />
          <select v-model="filters.type" class="input sm:w-48"><option value="">All types</option><option value="pharmacy">Pharmacies</option><option value="hospital">Hospitals / clinics</option></select>
        </div>
      </div>
      <DataTable :columns="columns" :rows="rows" :loading="loading" clickable @row-click="(t) => (selected = t)">
        <template #cell-name="{ row }">
          <div class="flex items-center gap-3">
            <span class="grid size-10 place-items-center rounded-xl" :class="row.type === 'pharmacy' ? 'bg-brand-50 text-brand-600' : 'bg-sky-50 text-sky-600'">
              <component :is="row.type === 'pharmacy' ? BuildingStorefrontIcon : BuildingOffice2Icon" class="size-5" />
            </span>
            <div>
              <p class="font-semibold text-slate-900">{{ row.name }}</p>
              <p class="text-xs text-slate-500">{{ titleCase(row.type) }} · joined <DateText :value="row.created_at" /></p>
              <p v-if="row.hospital" class="text-xs font-semibold text-sky-700">In-house pharmacy of {{ row.hospital.name }}</p>
              <p v-else-if="row.in_house_pharmacies?.length" class="text-xs font-semibold text-sky-700">Own pharmacy: {{ row.in_house_pharmacies.map((p) => `${p.name} (${p.status})`).join(', ') }}</p>
            </div>
          </div>
        </template>
        <template #cell-licence="{ row }"><p class="font-mono text-xs font-semibold">{{ row.license_number || '—' }}</p><p class="font-mono text-xs text-slate-400">{{ row.tin_number }}</p></template>
        <template #cell-location="{ row }">
          {{ [row.sub_city, row.city].filter(Boolean).join(', ') }}<p class="text-xs text-slate-400">{{ row.region }}</p>
          <span v-if="!hasPin(row)" class="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[0.68rem] font-bold text-amber-700 ring-1 ring-amber-200"><MapPinIcon class="size-3" /> No map pin</span>
        </template>
        <template #cell-users="{ row }">{{ row.users_count }}</template>
        <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1" @click.stop>
            <button v-if="row.status !== 'active'" class="btn btn-primary btn-sm" @click="setStatus(row, 'active')"><CheckIcon class="size-4" /> Approve</button>
            <button v-if="row.status === 'active'" class="btn btn-soft-danger btn-sm" @click="setStatus(row, 'suspended')"><NoSymbolIcon class="size-4" /> Suspend</button>
            <button v-if="row.status === 'pending'" class="btn btn-ghost btn-sm" @click="setStatus(row, 'rejected')">Reject</button>
          </div>
        </template>
      </DataTable>
      <AppPagination v-model="page" :meta="meta" />
    </div>

    <AppModal :open="!!selected" :title="selected?.name" :subtitle="selected ? `${titleCase(selected.type)} · ${selected.status}` : ''" @close="selected = null">
      <dl v-if="selected" class="grid grid-cols-2 gap-4 text-sm">
        <div v-if="selected.hospital" class="col-span-2 rounded-xl bg-sky-50 px-3 py-2 text-sky-900">In-house pharmacy of <b>{{ selected.hospital.name }}</b> ({{ selected.hospital.status }}) - it has its own EFDA licence below.</div>
        <div v-else-if="selected.in_house_pharmacies?.length" class="col-span-2 rounded-xl bg-sky-50 px-3 py-2 text-sky-900">
          Own pharmacy: <template v-for="(p, i) in selected.in_house_pharmacies" :key="p.id"><template v-if="i">, </template><b>{{ p.name }}</b> ({{ p.status }}<template v-if="p.license_number">, licence <span class="font-mono">{{ p.license_number }}</span></template>)</template>
          - approve it separately in this list.
        </div>
        <div><dt class="text-xs text-slate-400">Licence</dt><dd class="font-mono font-semibold">{{ selected.license_number || '—' }}</dd></div>
        <div><dt class="text-xs text-slate-400">TIN</dt><dd class="font-mono font-semibold">{{ selected.tin_number || '—' }}</dd></div>
        <div><dt class="text-xs text-slate-400">Phone</dt><dd class="font-semibold">{{ phone(selected.phone) }}</dd></div>
        <div><dt class="text-xs text-slate-400">Email</dt><dd class="font-semibold">{{ selected.email || '—' }}</dd></div>
        <div class="col-span-2"><dt class="text-xs text-slate-400">Address</dt><dd class="font-semibold">{{ [selected.address_line, selected.woreda && `Woreda ${selected.woreda}`, selected.sub_city, selected.city, selected.region].filter(Boolean).join(', ') }}</dd></div>
        <div><dt class="text-xs text-slate-400">Hours</dt><dd class="font-semibold">{{ selected.opening_hours || '—' }}</dd></div>
        <div><dt class="text-xs text-slate-400">Users · listings</dt><dd class="font-semibold">{{ selected.users_count }} · {{ selected.medicines_count }}</dd></div>
        <div v-if="selected.approved_at"><dt class="text-xs text-slate-400">Approved</dt><dd class="font-semibold"><DateText :value="selected.approved_at" /></dd></div>
 <div class="col-span-2">
          <dt class="text-xs text-slate-400">Map location</dt>
          <dd v-if="hasPin(selected)" class="font-semibold">
            <a :href="mapLink(selected)" target="_blank" rel="noopener" class="text-brand-700 hover:underline">{{ Number(selected.latitude).toFixed(5) }}, {{ Number(selected.longitude).toFixed(5) }} · view on map ↗</a>
          </dd>
          <dd v-else class="font-semibold text-amber-700">⚠ Not set - it won't appear in “near me” searches until its admin places the pin.</dd>
        </div>
        <div v-if="selected.status_reason" class="col-span-2 rounded-xl bg-rose-50 p-3"><dt class="text-xs text-rose-500">Reason given ({{ selected.status }})</dt><dd class="font-semibold text-rose-800">{{ selected.status_reason }}</dd></div>
      </dl>
      <template #footer>
        <button v-if="selected?.status === 'pending'" class="btn btn-ghost" @click="setStatus(selected, 'rejected')">Reject</button>
        <button v-if="selected?.status !== 'active'" class="btn btn-primary" @click="setStatus(selected, 'active')">Approve</button>
        <button v-else class="btn btn-soft-danger" @click="setStatus(selected, 'suspended')">Suspend</button>
      </template>
    </AppModal>
  </div>
</template>
