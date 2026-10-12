<script setup>
import { useRouter } from 'vue-router'
import { CalculatorIcon, InboxArrowDownIcon } from '@heroicons/vue/24/outline'
import { useFormat } from '@/composables/useFormat'
import { useList } from '@/composables/useList'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const router = useRouter()
const { dateTime, relative } = useFormat()
const { rows, meta, loading, filters, page } = useList('/rx-inbox', { status: 'open' })
const tabs = [{ value: 'open', label: 'To dispense' }, { value: 'dispensed', label: 'Dispensed' }, { value: 'expired', label: 'Expired' }]

/** Open the POS with the prescription code so the pharmacist can dispense it. */
const dispense = (rx) => router.push({ name: 'app.pos', query: { rx: rx.reference_code } })
</script>

<template>
  <div>
    <PageHeader title="e-Prescription inbox" eyebrow="Pharmacy" subtitle="Prescriptions doctors sent directly to your pharmacy - from your own hospital or partner facilities. Prepare them before the patient arrives." />
    <PillTabs v-model="filters.status" :tabs="tabs" class="mb-4" />

    <div v-if="loading && !rows.length" class="grid gap-4 md:grid-cols-2"><div v-for="i in 4" :key="i" class="skeleton h-40 rounded-2xl" /></div>
    <EmptyState v-else-if="!rows.length" title="Inbox is empty" text="New e-prescriptions appear here and you get a notification." class="card py-14"><InboxArrowDownIcon class="mx-auto size-10 text-slate-300" /></EmptyState>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <article v-for="rx in rows" :key="rx.id" class="card card-pad">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-mono text-sm font-bold text-slate-900">{{ rx.reference_code }}</p>
            <p class="font-semibold text-slate-800">{{ rx.patient?.full_name }}</p>
            <p class="text-xs text-slate-500">{{ rx.doctor?.name }} · {{ rx.hospital?.name }} · {{ relative(rx.issued_at) }}</p>
            <p v-if="rx.patient?.allergies" class="mt-1 text-xs font-bold text-rose-600">⚠ {{ rx.patient.allergies }}</p>
          </div>
          <StatusBadge :status="rx.status" />
        </div>
        <ul class="mt-3 space-y-1 text-sm">
          <li v-for="i in rx.items" :key="i.id" class="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5">
            <span>{{ i.medicine?.display_name }} <span class="text-xs text-slate-500">{{ i.dosage }}, {{ i.frequency }}</span></span>
            <b>{{ i.remaining_quantity ?? i.total_quantity }}</b>
          </li>
        </ul>
        <div class="mt-3 flex items-center justify-between">
          <span class="text-xs text-slate-500">Valid until {{ dateTime(rx.expires_at) }}</span>
          <button v-if="rx.is_dispensable" class="btn btn-primary btn-sm" @click="dispense(rx)"><CalculatorIcon class="size-4" /> Dispense at POS</button>
        </div>
      </article>
    </div>
    <AppPagination v-model="page" :meta="meta" class="mt-4" />
  </div>
</template>
