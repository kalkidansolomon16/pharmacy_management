<script setup>
import { computed, ref, watch } from 'vue'
import { CheckBadgeIcon, PencilSquareIcon, PlusIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, phone } from '@/lib/format'
import { useList } from '@/composables/useList'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import DataTable from '@/components/ui/DataTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import PatientPicker from '@/components/clinical/PatientPicker.vue'

const auth = useAuthStore()
const ui = useUiStore()
const canCreate = auth.can('insurance.create')
const canEdit = auth.can('insurance.update')
const tab = ref('payers')

const TYPES = { cbhi: 'CBHI (community-based)', private_insurance: 'Private insurer', corporate: 'Corporate credit', government: 'Government / SHI', ngo: 'NGO / programme' }
const COVERAGE = { registration: 'Card', consultation: 'Consultation', lab: 'Laboratory', medicine: 'Medicines', procedure: 'Procedures', other: 'Other' }

const payers = useList('/payers', {}, { perPage: 100, syncQuery: false })
const members = useList('/memberships', { search: '', payer_id: '' }, { syncQuery: false })

// Payer form
const editingPayer = ref(null)
const payerBlank = {
  name: '', code: '', type: 'cbhi', tin_number: '', phone: '', email: '', contact_person: '', address: '',
  default_copay_percent: 0, credit_limit: '', payment_terms_days: 30, preauth_threshold: '',
  coverage: Object.fromEntries(Object.keys(COVERAGE).map((k) => [k, true])), is_active: true,
}
const payerForm = useForm(payerBlank)
watch(editingPayer, (p) => p && payerForm.reset(p.id ? { ...payerBlank, ...p, phone: phone(p.phone) === '—' ? '' : phone(p.phone), credit_limit: p.credit_limit ?? '', preauth_threshold: p.preauth_threshold ?? '' } : payerBlank))
async function savePayer() {
  const d = { ...payerForm.data, credit_limit: payerForm.data.credit_limit || null, preauth_threshold: payerForm.data.preauth_threshold || null, tin_number: payerForm.data.tin_number || null, phone: payerForm.data.phone || null, email: payerForm.data.email || null }
  const req = editingPayer.value.id ? () => api.put(`/payers/${editingPayer.value.id}`, d) : () => api.post('/payers', d)
  await payerForm.submit(req, { onSuccess: () => { editingPayer.value = null; payers.reload() } }).catch(() => {})
}

// Member form
const editingMember = ref(null)
const memberPatient = ref(null)
const memberBlank = { payer_id: '', member_number: '', beneficiary_name: '', phone: '', scheme: '', employer: '', valid_from: '', valid_to: '', copay_percent: '', status: 'active' }
const memberForm = useForm(memberBlank)
watch(editingMember, (m) => {
  if (!m) return
  memberPatient.value = null
  memberForm.reset(m.id ? { ...memberBlank, ...m, phone: m.phone ? phone(m.phone) : '', copay_percent: m.copay_percent ?? '' } : { ...memberBlank, payer_id: payers.rows.value[0]?.id ?? '' })
})
watch(memberPatient, (p) => {
  if (p) Object.assign(memberForm.data, { beneficiary_name: p.full_name, phone: phone(p.phone) })
})
async function saveMember() {
  const d = { ...memberForm.data, patient_id: memberPatient.value?.id ?? editingMember.value.patient_id ?? null, copay_percent: memberForm.data.copay_percent === '' ? null : memberForm.data.copay_percent, phone: memberForm.data.phone || null, valid_from: memberForm.data.valid_from || null, valid_to: memberForm.data.valid_to || null }
  const req = editingMember.value.id ? () => api.put(`/memberships/${editingMember.value.id}`, d) : () => api.post('/memberships', d)
  await memberForm.submit(req, { onSuccess: () => { editingMember.value = null; members.reload() } }).catch(() => {})
}

// Quick eligibility check at the front desk
const check = ref({ payer_id: '', member_number: '', result: null, loading: false })
async function verify() {
  check.value.loading = true
  try {
    const { data } = await api.post('/memberships/verify', { payer_id: check.value.payer_id, member_number: check.value.member_number })
    check.value.result = { ...data.data, message: data.message }
  } catch (e) {
    check.value.result = { error: e.message }
  } finally {
    check.value.loading = false
  }
}

const payerColumns = [
  { key: 'name', label: 'Payer' }, { key: 'copay', label: 'Co-pay' }, { key: 'preauth', label: 'Pre-auth above' },
  { key: 'terms', label: 'Terms' }, { key: 'members', label: 'Members', align: 'center' }, { key: 'outstanding', label: 'Owes us', align: 'right' }, { key: 'actions', label: '', align: 'right' },
]
const memberColumns = [
  { key: 'member', label: 'Member' }, { key: 'payer', label: 'Payer' }, { key: 'valid', label: 'Valid' }, { key: 'copay', label: 'Co-pay' }, { key: 'status', label: '' }, { key: 'actions', label: '', align: 'right' },
]
const tabs = computed(() => [{ value: 'payers', label: 'Payers', count: payers.rows.value.length }, { value: 'members', label: 'Members', count: members.meta.value.total }])
</script>

<template>
  <div>
    <PageHeader title="Insurance & credit" eyebrow="Billing" subtitle="CBHI schemes, private insurers and corporate credit customers: who covers what, the co-pay, and when prior approval is needed.">
      <button v-if="canCreate && tab === 'payers'" class="btn btn-primary" @click="editingPayer = {}"><PlusIcon class="size-4" /> Add payer</button>
      <button v-if="canCreate && tab === 'members'" class="btn btn-primary" @click="editingMember = {}"><PlusIcon class="size-4" /> Enrol member</button>
    </PageHeader>

    <div class="card card-pad mb-6">
      <h2 class="flex items-center gap-2 font-bold text-slate-900"><CheckBadgeIcon class="size-5 text-brand-600" /> Check eligibility</h2>
      <form class="mt-3 flex flex-col gap-2 sm:flex-row" @submit.prevent="verify">
        <select v-model="check.payer_id" class="input sm:w-64" required><option value="" disabled>Payer…</option><option v-for="p in payers.rows.value" :key="p.id" :value="p.id">{{ p.name }}</option></select>
        <input v-model="check.member_number" class="input flex-1 font-mono" placeholder="Member / CBHI ID number" required />
        <button class="btn btn-secondary" :disabled="check.loading"><AppSpinner v-if="check.loading" /> Verify</button>
      </form>
      <div v-if="check.result" class="mt-3 rounded-xl px-4 py-3 text-sm" :class="check.result.error || !check.result.is_valid ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'">
        <template v-if="check.result.error">{{ check.result.error }}</template>
        <template v-else><b>{{ check.result.message }}</b> {{ check.result.beneficiary_name }} · {{ check.result.scheme || check.result.payer?.name }} · valid {{ check.result.valid_from || '…' }} → {{ check.result.valid_to || 'open' }} · co-pay {{ check.result.effective_copay_percent }}%</template>
      </div>
    </div>

    <PillTabs v-model="tab" :tabs="tabs" class="mb-4" />

    <div v-if="tab === 'payers'" class="card overflow-hidden">
      <DataTable :columns="payerColumns" :rows="payers.rows.value" :loading="payers.loading.value" empty-title="No payers yet">
        <template #cell-name="{ row }"><p class="font-semibold" :class="!row.is_active && 'text-slate-400'">{{ row.name }}</p><p class="text-xs text-slate-500">{{ TYPES[row.type] }} · {{ row.code }}</p></template>
        <template #cell-copay="{ row }">{{ row.default_copay_percent }}%</template>
        <template #cell-preauth="{ row }">{{ row.preauth_threshold ? money(row.preauth_threshold) : '—' }}</template>
        <template #cell-terms="{ row }">{{ row.payment_terms_days }} days<p v-if="row.credit_limit" class="text-xs text-slate-500">limit {{ money(row.credit_limit, { compact: true }) }}</p></template>
        <template #cell-members="{ row }">{{ row.memberships_count ?? '—' }}</template>
        <template #cell-outstanding="{ row }"><b>{{ row.outstanding != null ? money(row.outstanding) : '—' }}</b></template>
        <template #cell-actions="{ row }"><button v-if="canEdit" class="btn-icon size-8" @click="editingPayer = row"><PencilSquareIcon class="size-4" /></button></template>
      </DataTable>
    </div>

    <div v-else class="card overflow-hidden">
      <div class="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
        <SearchInput v-model="members.filters.search" placeholder="Member number or name" class="flex-1" />
        <select v-model="members.filters.payer_id" class="input sm:w-64"><option value="">All payers</option><option v-for="p in payers.rows.value" :key="p.id" :value="p.id">{{ p.name }}</option></select>
      </div>
      <DataTable :columns="memberColumns" :rows="members.rows.value" :loading="members.loading.value" empty-title="No members">
        <template #cell-member="{ row }"><p class="font-semibold">{{ row.beneficiary_name }}</p><p class="font-mono text-xs text-slate-500">{{ row.member_number }}</p></template>
        <template #cell-payer="{ row }">{{ row.payer?.name }}<p class="text-xs text-slate-500">{{ [row.scheme, row.employer].filter(Boolean).join(' · ') }}</p></template>
        <template #cell-valid="{ row }"><span class="text-xs">{{ row.valid_from || '…' }} → {{ row.valid_to || 'open' }}</span></template>
        <template #cell-copay="{ row }">{{ row.effective_copay_percent }}%</template>
        <template #cell-status="{ row }"><StatusBadge :status="row.is_valid ? 'active' : 'expired'" :label="row.is_valid ? 'Covered' : row.status === 'active' ? 'Lapsed' : row.status" /></template>
        <template #cell-actions="{ row }"><button v-if="canEdit" class="btn-icon size-8" @click="editingMember = row"><PencilSquareIcon class="size-4" /></button></template>
      </DataTable>
      <AppPagination v-model="members.page.value" :meta="members.meta.value" />
    </div>

    <AppModal :open="!!editingPayer" :title="editingPayer?.id ? 'Edit payer' : 'New payer'" size="lg" @close="editingPayer = null">
      <form id="payer-form" class="grid gap-4 sm:grid-cols-3" @submit.prevent="savePayer">
        <FormField label="Name" class="sm:col-span-2" :error="payerForm.errors.value.name" required><input v-model="payerForm.data.name" class="input" required /></FormField>
        <FormField label="Code" :error="payerForm.errors.value.code" required><input v-model="payerForm.data.code" class="input font-mono uppercase" required /></FormField>
        <FormField label="Type"><select v-model="payerForm.data.type" class="input"><option v-for="(l, v) in TYPES" :key="v" :value="v">{{ l }}</option></select></FormField>
        <FormField label="TIN" :error="payerForm.errors.value.tin_number"><input v-model="payerForm.data.tin_number" class="input font-mono" maxlength="10" /></FormField>
        <FormField label="Phone" :error="payerForm.errors.value.phone"><input v-model="payerForm.data.phone" class="input" /></FormField>
        <FormField label="Contact person"><input v-model="payerForm.data.contact_person" class="input" /></FormField>
        <FormField label="Email" :error="payerForm.errors.value.email"><input v-model="payerForm.data.email" type="email" class="input" /></FormField>
        <FormField label="Address"><input v-model="payerForm.data.address" class="input" /></FormField>
        <FormField label="Default co-pay (%)" :error="payerForm.errors.value.default_copay_percent"><input v-model="payerForm.data.default_copay_percent" type="number" min="0" max="100" class="input" /></FormField>
        <FormField label="Pre-authorize above (ETB)" hint="Insurer approval needed for larger bills"><input v-model="payerForm.data.preauth_threshold" type="number" min="0" class="input" /></FormField>
        <FormField label="Payment terms (days)"><input v-model="payerForm.data.payment_terms_days" type="number" min="0" class="input" /></FormField>
        <FormField label="Credit limit (ETB)"><input v-model="payerForm.data.credit_limit" type="number" min="0" class="input" /></FormField>
        <FormField label="Covers" class="sm:col-span-3">
          <div class="flex flex-wrap gap-2">
            <label v-for="(l, k) in COVERAGE" :key="k" class="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm" :class="payerForm.data.coverage[k] ? 'border-brand-400 bg-brand-50' : 'border-slate-200'">
              <input v-model="payerForm.data.coverage[k]" type="checkbox" class="rounded" /> {{ l }}
            </label>
          </div>
        </FormField>
        <FormField label="Active"><ToggleSwitch v-model="payerForm.data.is_active" /></FormField>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editingPayer = null">Cancel</button>
        <button form="payer-form" class="btn btn-primary" :disabled="payerForm.processing.value"><AppSpinner v-if="payerForm.processing.value" /> Save payer</button>
      </template>
    </AppModal>

    <AppModal :open="!!editingMember" :title="editingMember?.id ? 'Edit membership' : 'Enrol member'" size="lg" @close="editingMember = null">
      <form id="member-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveMember">
        <FormField v-if="!editingMember?.id && auth.hasModule('clinical')" label="Link to patient record (optional)" class="sm:col-span-2"><PatientPicker v-model="memberPatient" /></FormField>
        <FormField label="Payer" :error="memberForm.errors.value.payer_id" required><select v-model="memberForm.data.payer_id" class="input" required><option v-for="p in payers.rows.value" :key="p.id" :value="p.id">{{ p.name }}</option></select></FormField>
        <FormField label="Member / ID number" :error="memberForm.errors.value.member_number" required><input v-model="memberForm.data.member_number" class="input font-mono" required /></FormField>
        <FormField label="Beneficiary name" :error="memberForm.errors.value.beneficiary_name" required><input v-model="memberForm.data.beneficiary_name" class="input" required /></FormField>
        <FormField label="Phone" :error="memberForm.errors.value.phone"><input v-model="memberForm.data.phone" class="input" /></FormField>
        <FormField label="Scheme / plan"><input v-model="memberForm.data.scheme" class="input" placeholder="e.g. Household head, Gold plan" /></FormField>
        <FormField label="Employer"><input v-model="memberForm.data.employer" class="input" /></FormField>
        <FormField label="Valid from"><input v-model="memberForm.data.valid_from" type="date" class="input" /></FormField>
        <FormField label="Valid to" :error="memberForm.errors.value.valid_to"><input v-model="memberForm.data.valid_to" type="date" class="input" /></FormField>
        <FormField label="Co-pay override (%)" hint="Empty = payer default"><input v-model="memberForm.data.copay_percent" type="number" min="0" max="100" class="input" /></FormField>
        <FormField label="Status"><select v-model="memberForm.data.status" class="input"><option value="active">Active</option><option value="suspended">Suspended</option><option value="expired">Expired</option></select></FormField>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="editingMember = null">Cancel</button>
        <button form="member-form" class="btn btn-primary" :disabled="memberForm.processing.value"><AppSpinner v-if="memberForm.processing.value" /> Save</button>
      </template>
    </AppModal>
  </div>
</template>
