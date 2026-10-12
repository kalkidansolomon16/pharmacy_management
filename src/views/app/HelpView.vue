<script setup>
import { onMounted, ref } from 'vue'
import { ChatBubbleLeftRightIcon, EnvelopeIcon, PhoneIcon, PlayCircleIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'

const auth = useAuthStore()
const help = ref(null)
onMounted(async () => (help.value = (await api.get('/help')).data.data))

/** Short how-to guides per role, in plain language (Amharic / Afaan Oromo videos are linked from the tutorials channel). */
const guides = [
  { can: 'sales.create', title: 'Sell at the counter', steps: ['Open Point of sale (Alt + S).', 'Scan the pack or type the name and press Enter.', 'For prescription items, scan the patient\'s QR / code first.', 'Choose cash, telebirr, CBE Birr or M-Pesa and complete. No internet? Keep selling - sales sync later.'] },
  { can: 'visits.manage', title: 'Check in a patient', steps: ['Patient queue → Check in patient (Alt + Q).', 'Search the patient or register them.', 'Choose visit type and, if insured, the CBHI / insurer card.', 'Card and consultation fees go to the cashier automatically.'] },
  { can: 'triage.record', title: 'Record vital signs', steps: ['In the queue click Vitals next to the patient.', 'Enter temperature, BP, pulse, SpO₂, weight.', 'Danger signs are flagged and urgent patients move to the top.'] },
  { can: 'consultations.manage', title: 'See a patient', steps: ['Click See in the queue.', 'Write history, examination and choose ICD-10 diagnoses.', 'Order lab tests or prescribe - send the prescription to your pharmacy.', 'Complete the visit when done.'] },
  { can: 'lab.result', title: 'Run the lab worklist', steps: ['Laboratory (Alt + L) shows new orders, urgent first.', 'Take the sample once paid → "Sample collected".', 'Enter results; abnormal values are flagged and critical ones alert the doctor.', 'Verify to release results.'] },
  { can: 'billing.collect', title: 'Collect a payment', steps: ['Cashier (Alt + B) → To collect.', 'Open the invoice, choose the method and enter the transaction id for mobile money.', 'Print the fiscal receipt with the MoR QR code.'] },
  { can: 'purchasing.update', title: 'Receive goods', steps: ['Purchasing → open the PO → Mark as sent.', 'When goods arrive, scan each pack\'s DataMatrix to fill batch and expiry.', 'Receive into stock - batches are tracked for FEFO and recalls.'] },
  { can: 'insurance.claims', title: 'Send the monthly claim', steps: ['Claims → Prepare claim, choose the payer and month.', 'Download the PDF / CSV and submit to the scheme.', 'Record the payment (and any rejected amount) when it arrives.'] },
]
</script>

<template>
  <div>
    <PageHeader title="Help & support" eyebrow="We are here to help" subtitle="Quick guides for your role, keyboard shortcuts, and how to reach the MedLink support team in Amharic, Afaan Oromoo or English." />

    <div v-if="help" class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <a v-if="help.support.telegram" :href="`https://t.me/${help.support.telegram.replace('@', '')}`" target="_blank" rel="noopener" class="card card-hover card-pad flex items-center gap-3"><ChatBubbleLeftRightIcon class="size-8 text-sky-500" /><span><b class="block">Telegram</b><span class="text-sm text-slate-500">{{ help.support.telegram }}</span></span></a>
      <a v-if="help.support.phone" :href="`tel:${help.support.phone}`" class="card card-hover card-pad flex items-center gap-3"><PhoneIcon class="size-8 text-brand-600" /><span><b class="block">Call support</b><span class="text-sm text-slate-500">{{ help.support.phone }}</span></span></a>
      <a v-if="help.support.email" :href="`mailto:${help.support.email}`" class="card card-hover card-pad flex items-center gap-3"><EnvelopeIcon class="size-8 text-gold-500" /><span><b class="block">Email</b><span class="text-sm text-slate-500">{{ help.support.email }}</span></span></a>
      <a v-if="help.support.tutorials_url" :href="help.support.tutorials_url" target="_blank" rel="noopener" class="card card-hover card-pad flex items-center gap-3"><PlayCircleIcon class="size-8 text-rose-500" /><span><b class="block">Video tutorials</b><span class="text-sm text-slate-500">Amharic & Afaan Oromoo</span></span></a>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section class="grid gap-4 md:grid-cols-2">
        <article v-for="g in guides.filter((x) => auth.can(x.can))" :key="g.title" class="card card-pad">
          <h2 class="font-bold text-slate-900">{{ g.title }}</h2>
          <ol class="mt-3 space-y-2 text-sm text-slate-600">
            <li v-for="(s, i) in g.steps" :key="i" class="flex gap-2"><span class="grid size-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[0.68rem] font-bold text-white">{{ i + 1 }}</span>{{ s }}</li>
          </ol>
        </article>
      </section>
      <aside class="card card-pad h-fit">
        <h2 class="font-bold text-slate-900">Keyboard shortcuts</h2>
        <ul class="mt-3 divide-y divide-slate-100 text-sm">
          <li v-for="s in help?.shortcuts ?? []" :key="s.keys" class="flex justify-between py-2"><span class="text-slate-600">{{ s.action }}</span><kbd class="rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-xs">{{ s.keys }}</kbd></li>
        </ul>
        <p class="mt-3 text-xs text-slate-500">Press <kbd class="font-mono">?</kbd> anywhere to see this list.</p>
      </aside>
    </div>
  </div>
</template>
