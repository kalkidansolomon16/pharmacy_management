<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { BuildingStorefrontIcon, ClipboardDocumentCheckIcon, LockClosedIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { CheckBadgeIcon, XCircleIcon } from '@heroicons/vue/24/solid'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useFormat } from '@/composables/useFormat'
import FormField from '@/components/ui/FormField.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import PharmacyCard from '@/components/public/PharmacyCard.vue'

const route = useRoute()
const auth = useAuthStore()
const f = useFormat()

const code = ref(route.query.code ?? '')
const phone = ref(auth.user?.phone ?? '')
const loading = ref(false)
const error = ref('')
const result = ref(null)

async function check() {
  loading.value = true
  error.value = ''
  result.value = null
  try {
    const { data } = await api.post('/public/prescriptions/verify', { code: code.value, phone: phone.value })
    result.value = data.data
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => code.value && phone.value && check())
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
      <div class="pattern-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div class="relative mx-auto max-w-3xl px-4 pt-14 pb-10 text-center sm:px-6">
        <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30"><ClipboardDocumentCheckIcon class="size-7" /></span>
        <h1 class="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Check your prescription</h1>
        <p class="font-am mt-1 text-brand-700">የሐኪም ማዘዣዎን ያረጋግጡ</p>
        <p class="mx-auto mt-3 max-w-xl text-slate-500">Enter the code from your doctor and the phone number registered at the hospital. We'll show what you can still collect and where it's in stock.</p>

        <form class="card mx-auto mt-8 grid max-w-2xl gap-3 p-3 text-left sm:grid-cols-[1fr_1fr_auto]" @submit.prevent="check">
          <FormField><input v-model="code" class="input h-12 font-mono text-base tracking-wider uppercase" placeholder="RX-XXXX-XXXX" required /></FormField>
          <FormField><input v-model="phone" class="input h-12" placeholder="Phone e.g. 0911 223 344" required /></FormField>
          <button class="btn btn-primary h-12" :disabled="loading"><AppSpinner v-if="loading" /><MagnifyingGlassIcon v-else class="size-5" /> Check</button>
        </form>
        <p class="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400"><LockClosedIcon class="size-3.5" /> Clinical details are never shown publicly.</p>
      </div>
    </section>

    <section class="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
      <div v-if="error" class="card flex items-center gap-4 border-rose-200 bg-rose-50/50 p-5">
        <XCircleIcon class="size-10 shrink-0 text-rose-500" />
        <div><p class="font-bold text-rose-800">Not found</p><p class="text-sm text-rose-700">{{ error }}</p></div>
      </div>

      <div v-if="result" class="space-y-6 animate-fade-up">
        <div class="card overflow-hidden">
          <div class="flex flex-col gap-4 bg-gradient-to-r from-brand-700 to-brand-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="flex items-center gap-2 text-sm font-semibold text-brand-100"><CheckBadgeIcon class="size-5 text-gold-400" /> Genuine prescription</p>
              <p class="mt-1 font-mono text-2xl font-bold tracking-wider">{{ result.prescription.reference_code }}</p>
              <p class="mt-1 text-sm text-brand-100/80">For {{ result.prescription.patient.full_name }} · {{ result.prescription.doctor?.name }}, {{ result.prescription.hospital?.name }}</p>
            </div>
            <div class="text-left sm:text-right">
              <StatusBadge :status="result.prescription.status" class="!bg-white !text-brand-800" />
              <p class="mt-2 text-xs text-brand-100/80">Issued {{ f.date(result.prescription.issued_at) }}</p>
              <p class="text-xs font-semibold" :class="result.prescription.is_dispensable ? 'text-gold-300' : 'text-rose-200'">Valid until {{ f.date(result.prescription.expires_at) }}</p>
            </div>
          </div>
          <ul class="divide-y divide-slate-100">
            <li v-for="item in result.prescription.items" :key="item.id" class="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <MedicineAvatar :form="item.medicine.dosage_form" />
              <div class="min-w-0 flex-1">
                <p class="font-bold text-slate-900">{{ item.medicine.display_name }}</p>
                <p class="text-sm text-slate-500">{{ item.dosage }} · {{ item.frequency }} · {{ item.duration_days }} days</p>
              </div>
              <div class="w-full sm:w-56">
                <div class="flex justify-between text-xs font-semibold text-slate-500"><span>Collected {{ item.dispensed_quantity }} / {{ item.total_quantity }}</span><span class="text-brand-700">{{ item.remaining_quantity }} left</span></div>
                <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" :style="{ width: (item.dispensed_quantity / item.total_quantity) * 100 + '%' }" /></div>
              </div>
              <RouterLink v-if="item.remaining_quantity && result.prescription.is_dispensable" :to="{ name: 'search', query: { q: item.medicine.generic_name } }" class="btn btn-secondary btn-sm">Find</RouterLink>
            </li>
          </ul>
        </div>

        <div v-if="result.prescription.is_dispensable">
          <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900"><BuildingStorefrontIcon class="size-6 text-brand-600" /> Pharmacies with every item in stock</h2>
          <div v-if="result.pharmacies_with_all_items.length" class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PharmacyCard v-for="p in result.pharmacies_with_all_items" :key="p.id" :pharmacy="p" />
          </div>
          <p v-else class="card mt-4 p-5 text-sm text-slate-500">No single pharmacy has every item right now - search each medicine separately; partial collection is allowed.</p>
        </div>
      </div>
    </section>
  </div>
</template>
