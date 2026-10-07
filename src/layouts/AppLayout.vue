<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Bars3Icon, CalendarDaysIcon, GlobeAltIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { visibleNavigation } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useI18n } from '@/lib/i18n'
import { formatEthiopian } from '@/lib/ethiopianCalendar'
import api from '@/lib/api'
import AppLogo from '@/components/ui/AppLogo.vue'
import LanguageToggle from '@/components/layout/LanguageToggle.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'
import UserMenu from '@/components/layout/UserMenu.vue'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const { t, locale } = useI18n()

const sections = computed(() => visibleNavigation(auth))
const badges = reactive({ pendingOrders: 0, expiring: 0, pendingTenants: 0 })

const todayEthiopian = computed(() => formatEthiopian(new Date(), locale.value))
const todayGregorian = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** Small counters next to nav items, refreshed in the background. */
async function refreshBadges() {
  try {
    if (auth.can('orders.view') && auth.tenantType === 'pharmacy') {
      const [orders, alerts] = await Promise.all([
        api.get('/orders', { params: { status: 'pending', per_page: 1 } }),
        api.get('/inventory/alerts'),
      ])
      badges.pendingOrders = orders.data.meta.total
      badges.expiring = alerts.data.data.expiring_count + alerts.data.data.expired_with_stock_count
    }
    if (auth.can('tenants.manage')) {
      const { data } = await api.get('/admin/tenants', { params: { status: 'pending', per_page: 1 } })
      badges.pendingTenants = data.meta.total
    }
  } catch {
    /* non-critical */
  }
}

let timer
onMounted(() => {
  refreshBadges()
  timer = setInterval(refreshBadges, 60000)
})
onBeforeUnmount(() => clearInterval(timer))
watch(() => route.fullPath, () => (ui.sidebarOpen = false))

const isActive = (item) => route.name === item.to.name || item.also?.includes(route.name)
const toggleCalendar =() => (ui.calendar = ui.calendar === 'ethiopian' ? 'gregorian' : 'ethiopian')
const tenantTypeLabel = computed(() => ({ pharmacy: 'Pharmacy', hospital: 'Hospital / Clinic' })[auth.tenantType] ?? 'Platform administration')
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
            <LanguageToggle />
            <NotificationBell />
            <div class="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
            <UserMenu />
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>
