<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowPathIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, Cog6ToothIcon, PhoneIcon, UserPlusIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { phone } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

/**
 * Reception: appointments patients booked online (website / mobile app), by day.
 * "Check in" registers the patient (if new) and puts them in today's queue.
 */
const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const toDay = (d) => d.toISOString().slice(0, 10)
const localToday = () => {
  const n = new Date()
  return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
const date = ref(route.query.date || localToday())
const status = ref('')
const search = ref('')
const rows = ref([])
const meta = ref({})
const loading = ref(false)
const busy = ref(null)

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/appointments', { params: { date: date.value, status: status.value || undefined, search: search.value || undefined } })
    rows.value = data.data
    meta.value = data.meta
  } catch (e) {
    ui.error(e.message)
  } finally {
    loading.value = false
  }
}
watch([date, status], () => {
  router.replace({ query: { ...route.query, date: date.value } })
  load()
})
let debounce
watch(search, () => {
  clearTimeout(debounce)
  debounce = setTimeout(load, 350)
})
onMounted(load)
// Keep the day's list fresh for reception
const timer = setInterval(() => !busy.value && load(), 60000)
onBeforeUnmount(() => clearInterval(timer))

function shift(days) {
  const d = new Date(`${date.value}T12:00:00`)
  d.setDate(d.getDate() + days)
  date.value = toDay(d)
}
const isToday = computed(() => date.value === localToday())
const dayTitle = computed(() => new Date(`${date.value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
const counts = computed(() => meta.value.counts ?? {})
const tabs = computed(() => [
  { value: '', label: 'All' },
  { value: 'booked', label: 'Expected', count: counts.value.booked ?? 0 },
  { value: 'checked_in', label: 'Arrived', count: counts.value.checked_in ?? 0 },
  { value: 'no_show', label: 'No-show', count: counts.value.no_show ?? 0 },
  { value: 'cancelled', label: 'Cancelled', count: counts.value.cancelled ?? 0 },
])
const levelClass = {
  quiet: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  moderate: 'bg-sky-50 text-sky-700 ring-sky-200',
  busy: 'bg-amber-50 text-amber-700 ring-amber-200',
  full: 'bg-rose-50 text-rose-700 ring-rose-200',
}
const statusClass = {
  booked: 'bg-sky-50 text-sky-700',
  checked_in: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-emerald-50 text-emerald-700',
  no_show: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-50 text-rose-700',
}
const statusLabel = { booked: 'Expected', checked_in: 'Arrived', completed: 'Completed', no_show: 'No-show', cancelled: 'Cancelled' }
const typeLabel = { opd: 'Check-up / new problem', follow_up: 'Follow-up', antenatal: 'Antenatal (ANC)', other: 'Other' }
const canManage = computed(() => auth.can('visits.manage'))

async function act(a, action) {
  let body = {}
  if (action === 'cancel') {
    const reason = await ui.confirm({
      title: `Cancel ${a.patient_name}'s appointment?`,
      message: 'The patient is notified in the app and by email.',
      confirmText: 'Cancel appointment',
      danger: true,
      input: { label: 'Reason (sent to the patient)', placeholder: 'e.g. Doctor on leave - please book another day', required: true },
    })
    if (!reason) return
    body = { reason }
  }
  if (action === 'no-show' && !(await ui.confirm({ title: 'Mark as no-show?', message: `${a.patient_name} did not come at ${a.time}.`, confirmText: 'No-show' }))) return
  busy.value = a.id
  try {
    const { data } = await api.post(`/appointments/${a.id}/${action}`, body)
    ui.success(data.message)
    await load()
    if (action === 'check-in') router.push({ name: 'app.queue' })
  } catch (e) {
    ui.error(e.message)
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader title="Appointments" eyebrow="Booked online" subtitle="Patients book from the MedLink website and mobile app after seeing how busy you are. Check them in when they arrive - they join today's queue.">
      <RouterLink v-if="auth.can('organization.manage')" :to="{ name: 'app.settings' }" class="btn btn-secondary"><Cog6ToothIcon class="size-4" /> Hours & capacity</RouterLink>
    </PageHeader>

    <p v-if="meta.enabled === false" class="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
      Online appointments are switched <b>off</b> - patients cannot book you. Turn them on under Settings → Online appointments.
    </p>

    <div class="mb-5 flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1 rounded-2xl bg-white p-1 ring-1 ring-slate-200">
        <button class="btn-icon size-9" title="Previous day" @click="shift(-1)"><ChevronLeftIcon class="size-5" /></button>
        <label class="flex items-center gap-2 px-2">
          <CalendarDaysIcon class="size-5 text-brand-600" />
          <input v-model="date" type="date" class="border-0 bg-transparent p-0 text-sm font-semibold focus:ring-0" />
        </label>
        <button class="btn-icon size-9" title="Next day" @click="shift(1)"><ChevronRightIcon class="size-5" /></button>
      </div>
      <button v-if="!isToday" class="btn btn-secondary btn-sm" @click="date = localToday()">Today</button>
      <SearchInput v-model="search" placeholder="Name, phone or reference" class="w-64" />
      <button class="btn-icon size-10" title="Refresh" @click="load"><ArrowPathIcon class="size-5" :class="loading && 'animate-spin'" /></button>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <section>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="font-bold text-slate-900">{{ dayTitle }}</h2>
          <PillTabs v-model="status" :tabs="tabs" />
        </div>
        <div v-if="loading && !rows.length" class="skeleton h-64 rounded-2xl" />
        <EmptyState v-else-if="!rows.length" title="No appointments" :text="isToday ? 'Nobody booked online for today yet.' : 'Nothing booked for this day.'" />
        <ul v-else class="space-y-3">
          <li v-for="a in rows" :key="a.id" class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div class="grid w-20 shrink-0 place-items-center rounded-2xl bg-brand-50 py-2 text-brand-800">
              <span class="text-xl font-extrabold">{{ a.time }}</span>
              <span class="font-mono text-[0.65rem] text-brand-600">{{ a.reference }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-bold text-slate-900">
                {{ a.patient_name }}
                <span class="ml-2 rounded-full px-2 py-0.5 text-xs font-bold" :class="statusClass[a.status]">{{ statusLabel[a.status] ?? a.status }}</span>
              </p>
              <p class="text-sm text-slate-500">
                <a :href="`tel:${a.patient_phone}`" class="inline-flex items-center gap-1 hover:text-brand-700"><PhoneIcon class="size-3.5" />{{ phone(a.patient_phone) }}</a>
                · {{ a.gender === 'male' ? 'Male' : a.gender === 'female' ? 'Female' : '' }} · {{ typeLabel[a.type] ?? a.type }}<template v-if="a.specialty"> · <b class="text-brand-700">{{ a.specialty.name }}</b></template>
              </p>
              <p class="mt-1 text-sm text-slate-700">“{{ a.reason }}”</p>
              <p v-if="a.cancel_reason" class="mt-1 text-xs text-rose-600">{{ a.cancelled_by === 'patient' ? 'Cancelled by the patient' : 'Cancelled' }}: {{ a.cancel_reason }}</p>
            </div>
            <div v-if="a.status === 'booked' && canManage" class="flex shrink-0 flex-wrap gap-2">
              <button class="btn btn-primary btn-sm" :disabled="busy === a.id" @click="act(a, 'check-in')"><UserPlusIcon class="size-4" /> Check in</button>
              <button class="btn btn-secondary btn-sm" :disabled="busy === a.id" @click="act(a, 'no-show')">No-show</button>
              <button class="btn btn-ghost btn-sm text-rose-600" :disabled="busy === a.id" @click="act(a, 'cancel')">Cancel</button>
            </div>
            <RouterLink v-else-if="a.visit_id" :to="{ name: 'app.visit', params: { id: a.visit_id } }" class="btn btn-secondary btn-sm shrink-0">Open visit</RouterLink>
          </li>
        </ul>
      </section>

      <aside class="space-y-4">
        <div v-if="meta.live_queue" class="card card-pad">
          <h3 class="font-bold text-slate-900">Right now</h3>
          <p class="mt-1 text-sm text-slate-500">What patients see as your live queue.</p>
          <dl class="mt-3 grid grid-cols-2 gap-3 text-center">
            <div class="rounded-xl bg-slate-50 p-3"><dt class="text-xs text-slate-500">Waiting</dt><dd class="text-2xl font-extrabold">{{ meta.live_queue.waiting }}</dd></div>
            <div class="rounded-xl bg-slate-50 p-3"><dt class="text-xs text-slate-500">Est. wait</dt><dd class="text-2xl font-extrabold">{{ meta.live_queue.estimated_wait_minutes }}<span class="text-sm font-semibold"> min</span></dd></div>
          </dl>
        </div>
        <div class="card card-pad">
          <h3 class="font-bold text-slate-900">Slots this day</h3>
          <p class="mt-1 text-sm text-slate-500">How full each time is - patients pick the quieter ones.</p>
          <p v-if="!(meta.slots ?? []).length" class="mt-3 text-sm text-slate-400">Closed for appointments this day.</p>
          <ul v-else class="mt-3 grid grid-cols-3 gap-2">
            <li v-for="s in meta.slots" :key="s.time" class="rounded-xl px-2 py-1.5 text-center text-xs font-bold ring-1" :class="[levelClass[s.level], s.past && 'opacity-50']">
              {{ s.time }}<span class="block font-semibold">{{ s.booked }}/{{ s.capacity }}</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>
