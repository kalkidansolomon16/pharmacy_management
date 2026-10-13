<script setup>
import { computed, onMounted, ref } from 'vue'
import { CheckIcon } from '@heroicons/vue/24/solid'
import { ArrowDownCircleIcon, ArrowUpCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money } from '@/lib/format'
import { trialLabel } from '@/lib/trial'
import { useFormat } from '@/composables/useFormat'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const { date } = useFormat()
const ui = useUiStore()
const data = ref(null)
const load = async () => (data.value = (await api.get('/subscription')).data.data)
onMounted(load)
const USAGE_LABELS = { users: 'Staff accounts', branches: 'Locations', stores: 'Stores' }
const pct = (u) => (u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0)
const MODULE_LABELS = { pharmacy: 'Pharmacy & POS', clinical: 'Clinic / OPD', lab: 'Laboratory', billing: 'Billing & e-invoicing', insurance: 'Insurance & claims' }

// Plan change requests: ask MedLink to upgrade / downgrade
const change = computed(() => data.value?.change_request)
const openChange = computed(() => ['pending', 'scheduled'].includes(change.value?.status))
const currentPrice = computed(() => Number(data.value?.subscription?.plan?.price_monthly ?? 0))
const canRequest = computed(() => data.value?.subscription && data.value?.can_change_plan && !data.value?.is_branch && !openChange.value)

const target = ref(null)
const preview = ref(null)
const note = ref('')
const sending = ref(false)
async function choose(plan) {
  target.value = plan
  preview.value = null
  note.value = ''
  try {
    preview.value = (await api.get('/subscription/change-preview', { params: { plan_id: plan.id } })).data.data
  } catch (e) {
    ui.error(e.message)
    target.value = null
  }
}
async function sendRequest() {
  sending.value = true
  try {
    ui.success((await api.post('/subscription/change-requests', { plan_id: target.value.id, note: note.value || null })).data.message)
    target.value = null
    await load()
  } catch (e) {
    ui.error(e.message)
  } finally {
    sending.value = false
  }
}
async function cancelChange() {
  const ok = await ui.confirm({
    title: change.value.status === 'scheduled' ? 'Cancel the scheduled plan change?' : 'Withdraw your request?',
    message: `You will stay on ${data.value.subscription.plan?.name}.`,
    confirmText: 'Yes, cancel it',
    danger: true,
  })
  if (!ok) return
  try {
    ui.success((await api.post(`/subscription/change-requests/${change.value.id}/cancel`)).data.message)
    await load()
  } catch (e) {
    ui.error(e.message)
  }
}
const limitText = (v) => (v === null || v === undefined ? 'Unlimited' : v)
</script>

<template>
  <div>
    <PageHeader title="Subscription" eyebrow="MedLink plan" subtitle="Your plan, what it includes and how to renew. Your data is always yours - if a subscription lapses, everything stays readable." />
    <div v-if="!data" class="skeleton h-80 rounded-2xl" />
    <template v-else>
      <!-- Plan change request status -->
      <section v-if="change && (openChange || change.status === 'rejected' || change.status === 'applied')" class="mb-6 rounded-2xl px-5 py-4 ring-1"
        :class="{ 'bg-amber-50 ring-amber-200': change.status === 'pending', 'bg-sky-50 ring-sky-200': change.status === 'scheduled', 'bg-rose-50 ring-rose-200': change.status === 'rejected', 'bg-emerald-50 ring-emerald-200': change.status === 'applied' }">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex gap-3">
            <ClockIcon v-if="openChange" class="mt-0.5 size-5 shrink-0" :class="change.status === 'pending' ? 'text-amber-600' : 'text-sky-600'" />
            <ExclamationTriangleIcon v-else-if="change.status === 'rejected'" class="mt-0.5 size-5 shrink-0 text-rose-600" />
            <CheckIcon v-else class="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div class="text-sm">
              <p v-if="change.status === 'pending'" class="font-bold text-amber-900">Waiting for MedLink: {{ change.direction }} to {{ change.to_plan.name }}</p>
              <p v-else-if="change.status === 'scheduled'" class="font-bold text-sky-900">Approved: you move to {{ change.to_plan.name }} on {{ date(change.effective_at) }}</p>
              <p v-else-if="change.status === 'rejected'" class="font-bold text-rose-900">Your request to move to {{ change.to_plan.name }} was not approved</p>
              <p v-else class="font-bold text-emerald-900">You moved to {{ change.to_plan.name }} on {{ date(change.applied_at) }}</p>
              <p v-if="change.status === 'pending'" class="text-amber-800">Requested {{ date(change.created_at) }}<template v-if="change.requested_by"> by {{ change.requested_by.name }}</template>. You will get an email when it is decided.</p>
              <p v-if="change.status === 'scheduled'" class="text-sky-800">Until then you keep everything in {{ change.from_plan?.name }}, which you already paid for.</p>
              <p v-if="change.admin_note" class="mt-1" :class="change.status === 'rejected' ? 'text-rose-800' : 'text-slate-700'"><b>{{ change.status === 'rejected' ? 'Reason' : 'Note' }}:</b> {{ change.admin_note }}</p>
            </div>
          </div>
          <button v-if="openChange && data.can_change_plan" class="btn btn-secondary btn-sm" @click="cancelChange">{{ change.status === 'scheduled' ? 'Cancel change' : 'Withdraw request' }}</button>
        </div>
      </section>

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

      <p v-if="data.subscription && !data.is_branch && !data.can_change_plan" class="mb-3 text-sm text-slate-500">Only your organization admin or owner can ask to change the plan.</p>
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
          <p v-else-if="openChange && change.to_plan.id === p.id" class="mt-4 text-center text-sm font-bold text-amber-700">{{ change.status === 'scheduled' ? 'Your next plan' : 'Requested' }}</p>
          <p v-else-if="canRequest && data.core_module && !p.modules?.includes(data.core_module)" class="mt-4 text-center text-xs text-slate-400">Not for your type of organization</p>
          <button v-else-if="canRequest" class="btn mt-4 w-full" :class="Number(p.price_monthly) >= currentPrice ? 'btn-primary' : 'btn-secondary'" @click="choose(p)">
            <ArrowUpCircleIcon v-if="Number(p.price_monthly) >= currentPrice" class="size-4" /><ArrowDownCircleIcon v-else class="size-4" />
            {{ Number(p.price_monthly) >= currentPrice ? 'Request upgrade' : 'Request downgrade' }}
          </button>
        </article>
      </div>
    </template>

    <!-- What changes on the chosen plan -->
    <AppModal :open="!!target" :title="preview ? `${preview.direction === 'upgrade' ? 'Upgrade' : 'Downgrade'} to ${target?.name}` : target?.name" subtitle="MedLink reviews every plan change and emails you the answer." @close="target = null">
      <div v-if="!preview" class="flex justify-center py-10"><AppSpinner /></div>
      <div v-else class="space-y-4 text-sm">
        <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <span>{{ preview.from_plan?.name ?? 'No plan' }} → <b>{{ preview.to_plan.name }}</b></span>
          <span class="text-right"><b>{{ money(preview.to_plan.price_monthly) }}</b> / month
            <span class="block text-xs" :class="preview.price_difference > 0 ? 'text-amber-700' : 'text-emerald-700'">{{ preview.price_difference > 0 ? '+' : '' }}{{ money(preview.price_difference) }} per month</span>
          </span>
        </div>

        <div v-if="preview.modules_gained.length">
          <p class="font-semibold text-slate-900">You get</p>
          <ul class="mt-1 space-y-1"><li v-for="m in preview.modules_gained" :key="m" class="flex items-center gap-2 text-emerald-700"><CheckIcon class="size-4" /> {{ MODULE_LABELS[m] ?? m }}</li></ul>
        </div>
        <div v-if="preview.modules_lost.length" class="rounded-xl bg-rose-50 px-4 py-3 text-rose-800">
          <p class="font-semibold">These switch off</p>
          <ul class="mt-1 list-disc pl-5"><li v-for="m in preview.modules_lost" :key="m">{{ MODULE_LABELS[m] ?? m }}</li></ul>
          <p class="mt-1 text-xs">Nothing is deleted - the records stay and come back if you upgrade again.</p>
        </div>

        <table class="w-full text-left">
          <thead class="text-xs text-slate-500"><tr><th class="py-1 font-semibold">Limit</th><th class="py-1 font-semibold">Now</th><th class="py-1 font-semibold">New plan</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(l, key) in preview.limits" :key="key"><td class="py-1.5">{{ USAGE_LABELS[key] }}</td><td>{{ limitText(l.from) }}</td><td class="font-semibold">{{ limitText(l.to) }}</td></tr>
          </tbody>
        </table>

        <div v-if="preview.over_limit.length" class="rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
          <p class="flex items-center gap-2 font-semibold"><ExclamationTriangleIcon class="size-4" /> You are using more than the new plan allows</p>
          <ul class="mt-1 list-disc pl-5">
            <li v-for="o in preview.over_limit" :key="o.resource">You have {{ o.used }} {{ o.label }}; {{ preview.to_plan.name }} allows {{ o.limit }}.</li>
          </ul>
          <p class="mt-1 text-xs">Nothing is removed, but you cannot add more until you are under the limit (for example, deactivate staff accounts you no longer need).</p>
        </div>

        <p class="rounded-xl bg-brand-50 px-4 py-3 text-brand-900">
          <template v-if="preview.applies === 'period_end'">If approved, the change happens on <b>{{ date(preview.period_ends_at) }}</b>, when your paid period ends. You keep your current plan until then.</template>
          <template v-else>If approved, the change happens straight away. You pay the new price from your next payment.</template>
        </p>

        <label class="block">
          <span class="text-sm font-semibold text-slate-700">Note to MedLink (optional)</span>
          <textarea v-model="note" rows="2" maxlength="500" class="input mt-1" placeholder="e.g. We are opening a second branch next month" />
        </label>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="target = null">Cancel</button>
        <button class="btn btn-primary" :disabled="!preview || sending" @click="sendRequest"><AppSpinner v-if="sending" /> Send request</button>
      </template>
    </AppModal>
  </div>
</template>
