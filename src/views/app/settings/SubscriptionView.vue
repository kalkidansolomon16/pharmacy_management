<script setup>
import { onMounted, ref } from 'vue'
import { CheckIcon } from '@heroicons/vue/24/solid'
import api from '@/lib/api'
import { money } from '@/lib/format'
import { trialLabel } from '@/lib/trial'
import { useFormat } from '@/composables/useFormat'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const { date } = useFormat()
const data = ref(null)
onMounted(async () => (data.value = (await api.get('/subscription')).data.data))
const USAGE_LABELS = { users: 'Staff accounts', branches: 'Locations', stores: 'Stores' }
const pct = (u) => (u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0)
const MODULE_LABELS = { pharmacy: 'Pharmacy & POS', clinical: 'Clinic / OPD', lab: 'Laboratory', billing: 'Billing & e-invoicing', insurance: 'Insurance & claims' }
</script>

<template>
  <div>
    <PageHeader title="Subscription" eyebrow="MedLink plan" subtitle="Your plan, what it includes and how to renew. Your data is always yours - if a subscription lapses, everything stays readable." />
    <div v-if="!data" class="skeleton h-80 rounded-2xl" />
    <template v-else>
      <section v-if="data.subscription" class="card card-pad mb-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-xs font-bold tracking-wider text-brand-600 uppercase">Current plan</p>
            <p class="text-2xl font-extrabold text-slate-900">{{ data.subscription.plan?.name }}</p>
            <p class="text-sm text-slate-500">{{ data.subscription.status === 'trial' ? 'Free trial ends' : 'Paid until' }} {{ date(data.subscription.ends_at) }}<template v-if="data.subscription.days_left !== null"> · {{ data.subscription.days_left }} day(s) left</template></p>
          </div>
          <StatusBadge :status="data.subscription.is_usable ? data.subscription.status : 'expired'" />
        </div>
        <p v-if="data.is_branch" class="mt-2 text-sm text-slate-500">This branch runs on your head office's plan.</p>
        <div v-if="data.usage" class="mt-5 grid gap-4 sm:grid-cols-3">
          <div v-for="(u, key) in data.usage" :key="key">
            <p class="flex justify-between text-sm"><span class="font-semibold text-slate-700">{{ USAGE_LABELS[key] }}</span><span class="tabular-nums" :class="u.limit && u.used >= u.limit ? 'font-bold text-rose-600' : 'text-slate-500'">{{ u.used }} / {{ u.limit ?? '∞' }}</span></p>
            <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full" :class="pct(u) >= 100 ? 'bg-rose-500' : pct(u) >= 80 ? 'bg-amber-500' : 'bg-brand-500'" :style="{ width: (u.limit ? pct(u) : 4) + '%' }" /></div>
            <p v-if="u.limit && u.used >= u.limit" class="mt-1 text-xs font-semibold text-rose-600">Limit reached - upgrade to add more.</p>
          </div>
        </div>
        <p class="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">{{ data.payment_instructions }}</p>
        <div v-if="data.subscription.payments?.length" class="mt-4">
          <h3 class="text-sm font-bold text-slate-900">Payment history</h3>
          <ul class="mt-2 divide-y divide-slate-100 text-sm">
            <li v-for="(p, i) in data.subscription.payments" :key="i" class="flex justify-between py-2"><span>{{ date(p.period_start) }} – {{ date(p.period_end) }} · {{ p.method }} <span class="font-mono text-xs text-slate-400">{{ p.reference }}</span></span><b>{{ money(p.amount) }}</b></li>
          </ul>
        </div>
      </section>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article v-for="p in data.plans" :key="p.id" class="card card-pad flex flex-col" :class="data.subscription?.plan?.id === p.id && 'ring-2 ring-brand-500'">
          <p class="flex items-center justify-between gap-2 font-bold text-slate-900">
            {{ p.name }}
            <span v-if="trialLabel(p.trial_days)" class="chip bg-gold-100 text-amber-800 ring-gold-300">🎁 {{ trialLabel(p.trial_days) }}</span>
          </p>
          <p class="mt-1 text-3xl font-extrabold">{{ money(p.price_monthly, { symbol: '' }) }} <span class="text-sm font-semibold text-slate-500">ETB / month</span></p>
          <p v-if="trialLabel(p.trial_days)" class="text-xs font-semibold text-amber-700">Pay nothing for the first {{ p.trial_days }} days</p>
          <p class="mt-2 text-sm text-slate-600">{{ p.description }}</p>
          <ul class="mt-4 flex-1 space-y-1.5 text-sm">
            <li v-for="m in p.modules" :key="m" class="flex items-center gap-2"><CheckIcon class="size-4 text-brand-600" /> {{ MODULE_LABELS[m] ?? m }}</li>
            <li class="text-xs text-slate-500">Up to {{ p.max_users }} staff accounts · {{ p.max_branches }} location{{ p.max_branches === 1 ? '' : 's' }} · {{ p.max_stores }} stores</li>
          </ul>
          <p v-if="data.subscription?.plan?.id === p.id" class="mt-4 text-center text-sm font-bold text-brand-700">Your plan</p>
        </article>
      </div>
    </template>
  </div>
</template>
