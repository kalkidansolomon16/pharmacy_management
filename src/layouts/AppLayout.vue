<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bars3Icon, CalendarDaysIcon, ExclamationTriangleIcon, GlobeAltIcon, SignalIcon, SignalSlashIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { visibleNavigation } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useI18n } from '@/lib/i18n'
import { formatEthiopian } from '@/lib/ethiopianCalendar'
import api from '@/lib/api'
import { useOfflineStore } from '@/stores/offline'
import AppModal from '@/components/ui/AppModal.vue'
import AppLogo from '@/components/ui/AppLogo.vue'
import LanguageToggle from '@/components/layout/LanguageToggle.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'
import UserMenu from '@/components/layout/UserMenu.vue'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const offline = useOfflineStore()
const { t, locale } = useI18n()

const sections = computed(() => visibleNavigation(auth))
const badges = reactive({ pendingOrders: 0, expiring: 0, pendingTenants: 0, waiting: 0, labOpen: 0, unpaid: 0, approvals: 0, rxInbox: 0 })

const todayEthiopian = computed(() => formatEthiopian(new Date(), locale.value))
const todayGregorian = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** Small counters next to nav items, refreshed in the background. */
async function refreshBadges() {
  try {
    if (auth.can('orders.view') && auth.hasModule('pharmacy')) {
      const [orders, alerts] = await Promise.all([
        api.get('/orders', { params: { status: 'pending', per_page: 1 } }),
        api.get('/inventory/alerts'),
      ])
      badges.pendingOrders = orders.data.meta.total
      badges.expiring = alerts.data.data.expiring_count + alerts.data.data.expired_with_stock_count
    }
    const jobs = []
    if (auth.can('visits.view') && auth.hasModule('clinical')) {
      jobs.push(api.get('/visits', { params: { status: 'open', per_page: 1 } }).then(({ data }) => {
        badges.waiting = data.meta.counts?.waiting ?? 0
      }))
    }
    if (auth.can('lab.view') && auth.hasModule('lab')) {
      jobs.push(api.get('/lab-orders', { params: { status: 'open', per_page: 1 } }).then(({ data }) => {
        badges.labOpen = (data.meta.counts?.ordered ?? 0) + (data.meta.counts?.collected ?? 0)
      }))
    }
    if (auth.can('billing.view') && auth.hasModule('billing')) {
      jobs.push(api.get('/invoices', { params: { per_page: 1 } }).then(({ data }) => {
        badges.unpaid = data.meta.unpaid_count ?? 0
        badges.approvals = data.meta.awaiting_approval ?? 0
      }))
    }
    if (auth.can('prescriptions.dispense') && auth.hasModule('pharmacy')) {
      jobs.push(api.get('/rx-inbox', { params: { per_page: 1 } }).then(({ data }) => (badges.rxInbox = data.meta.total)))
    }
    await Promise.allSettled(jobs)
    if (auth.can('tenants.manage')) {
      const { data } = await api.get('/admin/tenants', { params: { status: 'pending', per_page: 1 } })
      badges.pendingTenants = data.meta.total
    }
  } catch {
    /* non-critical */
  }
}

/** Trial ending / expired subscription warning for the organization. */
const subscriptionNotice = computed(() => {
  const sub = auth.subscription
  if (!sub || !auth.tenant) return null
  if (!sub.usable) return { tone: 'rose', text: 'Your subscription has expired. Records are read-only until it is renewed.' }
  if (sub.days_left !== null && sub.days_left < 0) return { tone: 'rose', text: `Subscription ended - ${7 + sub.days_left} day(s) of grace left. Renew to keep recording sales.` }
  if (sub.days_left !== null && sub.days_left <= 7) {
    return { tone: 'amber', text: sub.status === 'trial' ? `Free trial ends in ${sub.days_left} day(s).` : `Subscription renews in ${sub.days_left} day(s).` }
  }
  return null
})

/** Keyboard shortcuts for busy counters (Alt + letter); "?" lists them. */
const shortcutsOpen = ref(false)
const shortcuts = [
  { keys: 'Alt + S', action: 'Counter sale (POS)', to: 'app.pos' },
  { keys: 'Alt + Q', action: 'Patient queue', to: 'app.queue' },
  { keys: 'Alt + P', action: 'Patients', to: 'app.patients' },
  { keys: 'Alt + I', action: 'Inventory', to: 'app.inventory' },
  { keys: 'Alt + B', action: 'Cashier', to: 'app.cashier' },
  { keys: 'Alt + L', action: 'Laboratory', to: 'app.lab' },
  { keys: 'Alt + D', action: 'Dashboard', to: 'app.dashboard' },
  { keys: '/', action: 'Focus the search box' },
  { keys: '?', action: 'Show this list' },
]
function onKey(e) {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const hit = shortcuts.find((s) => s.to && s.keys === 'Alt + ' + e.key.toUpperCase())
    if (hit) {
      e.preventDefault()
      router.push({ name: hit.to }).catch(() => {})
    }
    return
  }
  if (typing) return
  if (e.key === '?') shortcutsOpen.value = true
  if (e.key === '/') {
    const input = document.querySelector('main input[type="search"], main input')
    if (input) {
      e.preventDefault()
      input.focus()
    }
  }
}

let timer
onMounted(() => {
  refreshBadges()
  timer = setInterval(refreshBadges, 60000)
  window.addEventListener('keydown', onKey)
  offline.flush()
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('keydown', onKey)
})
watch(() => route.fullPath, () => (ui.sidebarOpen = false))

const isActive = (item) => route.name === item.to.name || item.also?.includes(route.name)
const toggleCalendar =() => (ui.calendar = ui.calendar === 'ethiopian' ? 'gregorian' : 'ethiopian')
const tenantTypeLabel = computed(() => {
  const base = ({ pharmacy: 'Pharmacy', hospital: 'Hospital / Clinic' })[auth.tenantType] ?? 'Platform administration'
  return auth.tenant?.parent_id ? base + ' · Branch' : base
})
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <!-- Sidebar -->
    <Transition name="fade">
      <div v-if="ui.sidebarOpen" class="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" @click="ui.sidebarOpen = false" />
    </Transition>
    <aside
      class="no-print fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-gradient-to-b from-brand-900 via-brand-950 to-[#011a14] text-brand-100 transition-transform duration-300 lg:translate-x-0"
      :class="ui.sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'"
    >
      <div class="pattern-dots pointer-events-none absolute inset-0 opacity-50" />
      <div class="pointer-events-none absolute -top-20 -right-24 size-64 rounded-full bg-brand-400/20 blur-3xl" />
      <div class="relative flex items-center justify-between px-5 pt-5 pb-4">
        <RouterLink :to="{ name: 'app.dashboard' }"><AppLogo dark /></RouterLink>
        <button class="rounded-lg p-1.5 text-white/70 hover:bg-white/10 lg:hidden" @click="ui.sidebarOpen = false"><XMarkIcon class="size-5" /></button>
      </div>

      <div class="relative mx-4 mb-2 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5">
        <p class="text-[0.68rem] font-bold tracking-[0.14em] text-gold-400/90 uppercase">{{ tenantTypeLabel }}</p>
        <p class="mt-0.5 truncate font-bold text-white">{{ auth.tenant?.name ?? 'MedLink Ethiopia' }}</p>
        <p class="truncate text-xs text-brand-200/70">{{ auth.tenant ? [auth.tenant.sub_city, auth.tenant.city].filter(Boolean).join(', ') : 'All regions' }}</p>
      </div>

      <nav class="relative flex-1 space-y-6 overflow-y-auto px-3 py-4 scrollbar-thin">
        <div v-for="s in sections" :key="s.section">
          <p class="mb-2 px-3 text-[0.68rem] font-bold tracking-[0.16em] text-brand-300/50 uppercase">{{ t(s.section) }}</p>
          <ul class="space-y-0.5">
            <li v-for="item in s.items" :key="item.key + item.tenantType">
              <RouterLink
                :to="item.to"
                class="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
                :class="isActive(item) ? 'bg-white/[0.12] text-white shadow-inner shadow-black/10' : 'text-brand-100/75 hover:bg-white/[0.07] hover:text-white'"
              >
                <span v-if="isActive(item)" class="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-gold-400" />
                <component :is="item.icon" class="size-5 shrink-0 transition group-hover:text-gold-300" :class="isActive(item) ? 'text-gold-400' : 'text-brand-300/70'" />
                <span class="flex-1 truncate">{{ t(item.key) }}</span>
                <span v-if="item.badge && badges[item.badge]" class="rounded-full bg-gold-400 px-1.5 py-px text-[0.68rem] font-extrabold text-brand-950">{{ badges[item.badge] }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>
      </nav>

      <div class="relative border-t border-white/10 p-4">
        <RouterLink to="/" class="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-brand-200/70 hover:bg-white/5 hover:text-white">
          <GlobeAltIcon class="size-4" /> Public website
        </RouterLink>
        <div class="tibeb mt-3 h-2.5 rounded-full opacity-60" />
      </div>
    </aside>

    <!-- Main -->
    <div class="lg:pl-72">
      <header class="no-print sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div class="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div class="flex min-w-0 items-center gap-2">
            <button class="btn-icon lg:hidden" aria-label="Open menu" @click="ui.sidebarOpen = true"><Bars3Icon class="size-6" /></button>
            <button
              class="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-left shadow-xs transition hover:border-brand-300 sm:flex"
              :title="`Showing dates in the ${ui.calendar} calendar. Click to switch.`"
              @click="toggleCalendar"
            >
              <CalendarDaysIcon class="size-5 text-brand-600" />
              <span class="leading-tight">
                <span class="block text-xs font-bold text-slate-800" :class="locale === 'am' && 'font-am'">{{ todayEthiopian }}</span>
                <span class="block text-[0.68rem] text-slate-500">{{ todayGregorian }} · {{ ui.calendar === 'ethiopian' ? 'E.C. dates' : 'G.C. dates' }}</span>
              </span>
            </button>
          </div>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <span
              class="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex"
              :class="offline.online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-900 text-white'"
              :title="offline.online ? 'Connected' : 'Offline - counter sales are saved on this device'"
            >
              <component :is="offline.online ? SignalIcon : SignalSlashIcon" class="size-3.5" />
              {{ offline.online ? t('status.online') : t('status.offline') }}<template v-if="offline.pending"> · {{ offline.pending }} {{ t('status.queued') }}</template>
            </span>
            <LanguageToggle />
            <NotificationBell />
            <div class="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
            <UserMenu />
          </div>
        </div>
      </header>

      <div
        v-if="subscriptionNotice"
        class="no-print flex items-center gap-3 border-b px-4 py-2 text-sm sm:px-6 lg:px-8"
        :class="subscriptionNotice.tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'"
      >
        <ExclamationTriangleIcon class="size-4 shrink-0" />
        <span class="flex-1">{{ subscriptionNotice.text }}</span>
        <RouterLink v-if="auth.can('subscription.view')" :to="{ name: 'app.subscription' }" class="font-bold underline">Manage subscription</RouterLink>
      </div>

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <AppModal :open="shortcutsOpen" title="Keyboard shortcuts" subtitle="Work faster at the counter - no mouse needed." size="sm" @close="shortcutsOpen = false">
      <ul class="divide-y divide-slate-100 text-sm">
        <li v-for="s in shortcuts" :key="s.keys" class="flex items-center justify-between py-2">
          <span class="text-slate-600">{{ s.action }}</span>
          <kbd class="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">{{ s.keys }}</kbd>
        </li>
      </ul>
    </AppModal>
  </div>
</template>
