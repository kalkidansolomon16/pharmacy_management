<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ClipboardDocumentIcon, PrinterIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { phone } from '@/lib/format'
import { formatEthiopian } from '@/lib/ethiopianCalendar'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import QrCode from '@/components/ui/QrCode.vue'
import AppLogo from '@/components/ui/AppLogo.vue'

const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()
const rx = ref(null)

async function load() {
  rx.value = (await api.get(`/prescriptions/${route.params.id}`)).data.data
}
onMounted(load)

const canCancel = computed(() => rx.value && ['active', 'partially_dispensed'].includes(rx.value.status) && (rx.value.doctor?.id === auth.user?.id || auth.hasRole('hospital_admin')))
const verifyUrl = computed(() => rx.value ? `${window.location.origin}/prescription-check?code=${rx.value.reference_code}` : '')

async function cancel() {
  const reason = await ui.confirm({ title: 'Cancel this prescription?', message: 'Pharmacies will no longer be able to dispense it.', confirmText: 'Cancel prescription', danger: true, input: { label: 'Reason', required: true } })
  if (!reason) return
  try {
    await api.post(`/prescriptions/${rx.value.id}/cancel`, { reason })
    ui.success('Prescription cancelled.')
    load()
  } catch (e) {
    ui.error(e.message)
  }
}

function copy() {
  navigator.clipboard?.writeText(rx.value.reference_code)
  ui.success('Code copied - share it with the patient by SMS or Telegram.')
}
const printRx = () => window.print()
</script>

<template>
  <div>
    <RouterLink :to="{ name: 'app.prescriptions' }" class="no-print text-sm font-semibold text-slate-500 hover:text-slate-800">← Prescriptions</RouterLink>
    <div v-if="!rx" class="skeleton mt-4 h-[36rem] rounded-3xl" />
    <template v-else>
      <div class="no-print mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div class="flex items-center gap-2"><StatusBadge :status="rx.status" /><span class="text-sm text-slate-500">Issued <DateText :value="rx.issued_at" time /></span></div>
        <div class="flex gap-2">
          <button class="btn btn-secondary" @click="copy"><ClipboardDocumentIcon class="size-4" /> Copy code</button>
          <button v-if="canCancel" class="btn btn-soft-danger" @click="cancel"><XCircleIcon class="size-4" /> Cancel</button>
          <button class="btn btn-primary" @click="printRx"><PrinterIcon class="size-4" /> Print</button>
        </div>
      </div>

      <!-- The prescription sheet -->
      <article class="print-area card relative mx-auto mt-6 max-w-3xl overflow-hidden">
        <div class="flag-ribbon h-1.5" />
        <header class="flex flex-col justify-between gap-4 border-b border-slate-100 p-8 sm:flex-row">
          <div>
            <p class="text-xl font-extrabold text-slate-900">{{ rx.hospital?.name }}</p>
            <p class="text-sm text-slate-500">{{ auth.tenant?.address_line }}{{ auth.tenant?.sub_city ? ', ' + auth.tenant.sub_city : '' }}, {{ rx.hospital?.city }} · Tel {{ phone(rx.hospital?.phone) }}</p>
            <p class="mt-4 text-5xl font-extrabold text-brand-700 italic">℞</p>
          </div>
          <div class="text-left sm:text-right">
            <QrCode :value="verifyUrl" :size="120" class="ring-1 ring-slate-200" />
            <p class="mt-2 font-mono text-lg font-extrabold tracking-wider text-slate-900">{{ rx.reference_code }}</p>
          </div>
        </header>

        <section class="grid gap-4 border-b border-slate-100 p-8 text-sm sm:grid-cols-4">
          <div class="sm:col-span-2"><p class="text-xs text-slate-400">Patient</p><p class="font-bold text-slate-900">{{ rx.patient?.full_name }}</p></div>
          <div><p class="text-xs text-slate-400">Age / sex</p><p class="font-semibold">{{ rx.patient?.age ?? '—' }} / {{ rx.patient?.gender === 'female' ? 'F' : 'M' }}</p></div>
          <div><p class="text-xs text-slate-400">Card no.</p><p class="font-mono font-semibold">{{ rx.patient?.mrn || '—' }}</p></div>
          <div class="sm:col-span-2"><p class="text-xs text-slate-400">Diagnosis</p><p class="font-semibold">{{ rx.diagnosis || '—' }}</p></div>
          <div class="sm:col-span-2"><p class="text-xs text-slate-400">Allergies</p><p class="font-semibold" :class="rx.patient?.allergies && 'text-rose-600'">{{ rx.patient?.allergies || 'None known' }}</p></div>
        </section>

        <ol class="divide-y divide-slate-100 px-8">
          <li v-for="(item, i) in rx.items" :key="item.id" class="flex gap-4 py-5">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{{ i + 1 }}</span>
            <div class="flex-1">
              <p class="font-bold text-slate-900">{{ item.medicine?.display_name }} <span class="font-normal text-slate-500">{{ item.medicine?.dosage_form }}</span></p>
              <p class="text-sm text-slate-700">{{ item.dosage }} · {{ item.frequency }} · for {{ item.duration_days }} days</p>
              <p v-if="item.instructions" class="text-sm text-slate-500 italic">{{ item.instructions }}</p>
            </div>
            <div class="text-right text-sm">
              <p class="font-bold">Qty {{ item.total_quantity }}</p>
              <p class="no-print text-xs" :class="item.remaining_quantity ? 'text-slate-500' : 'text-emerald-600'">{{ item.dispensed_quantity }} dispensed</p>
            </div>
          </li>
        </ol>

        <footer class="mt-4 grid gap-6 border-t border-slate-100 bg-slate-50/60 p-8 text-sm sm:grid-cols-2">
          <div>
            <p class="text-xs text-slate-400">Prescriber</p>
            <p class="font-bold text-slate-900">{{ rx.doctor?.name }}</p>
            <p class="text-xs text-slate-500">Licence {{ rx.doctor?.license_number || '—' }}</p>
            <div class="mt-6 w-48 border-t border-slate-400 pt-1 text-xs text-slate-400">Signature & stamp</div>
          </div>
          <div class="sm:text-right">
            <p class="text-xs text-slate-400">Issued</p>
            <p class="font-semibold"><DateText :value="rx.issued_at" /></p>
            <p class="font-am text-xs text-slate-500">{{ formatEthiopian(rx.issued_at, 'am') }}</p>
            <p class="mt-2 text-xs text-slate-400">Valid until</p>
            <p class="font-semibold"><DateText :value="rx.expires_at" /></p>
          </div>
          <p class="text-xs text-slate-400 sm:col-span-2">
            Scan the QR or enter the code at any MedLink Ethiopia pharmacy. Quantities are tracked across pharmacies; the total dispensed can never exceed what is prescribed.
          </p>
          <AppLogo compact class="hidden print:inline-flex" />
        </footer>
      </article>
    </template>
  </div>
</template>
