<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Bars3Icon, PhoneIcon, ShoppingCartIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { publicLinks } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useI18n } from '@/lib/i18n'
import { formatEthiopian } from '@/lib/ethiopianCalendar'
import AppLogo from '@/components/ui/AppLogo.vue'
import LanguageToggle from '@/components/layout/LanguageToggle.vue'
import UserMenu from '@/components/layout/UserMenu.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'

const auth = useAuthStore()
const cart = useCartStore()
const route = useRoute()
const { t, locale } = useI18n()
const mobileOpen = ref(false)
const isHome = computed(() => route.name === 'home')
const today = computed(() => formatEthiopian(new Date(), locale.value, { weekday: true }))

watch(() => route.fullPath, () => (mobileOpen.value = false))
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- Emergency strip -->
    <div class="no-print bg-brand-950 text-[0.78rem] text-brand-100">
      <div class="flag-ribbon h-[3px]" />
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 sm:px-6">
        <p class="flex items-center gap-1.5">
          <PhoneIcon class="size-3.5 text-gold-400" />
          <span>Medical emergency? Ambulance <b class="text-white">907</b> · Police <b class="text-white">991</b> · Fire <b class="text-white">939</b></span>
        </p>
        <p class="hidden font-am text-brand-200/80 md:block">{{ today }}</p>
      </div>
    </div>

    <header class="no-print sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <RouterLink to="/" aria-label="MedLink Ethiopia home"><AppLogo /></RouterLink>

        <nav class="hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="link in publicLinks"
            :key="link.key"
            :to="link.to"
            class="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            active-class="!text-brand-700 bg-brand-50"
          >
            {{ t(link.key) }}
          </RouterLink>
        </nav>

        <div class="flex items-center gap-2">
          <LanguageToggle class="hidden sm:inline-flex" />
          <RouterLink :to="{ name: 'cart' }" class="btn-icon relative" :aria-label="t('nav.cart')">
            <ShoppingCartIcon class="size-5.5" />
            <span v-if="cart.itemCount" class="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-gold-400 px-1 text-[0.65rem] font-extrabold text-brand-950 ring-2 ring-white">
              {{ cart.itemCount }}
            </span>
          </RouterLink>
          <template v-if="auth.isAuthenticated">
            <NotificationBell :all-link="{ name: auth.isStaffUser ? 'app.notifications' : 'account.notifications' }" />
            <RouterLink v-if="auth.isStaffUser" :to="{ name: 'app.dashboard' }" class="btn btn-primary btn-sm hidden sm:inline-flex">{{ t('nav.dashboard') }}</RouterLink>
            <UserMenu />
          </template>
          <template v-else>
            <RouterLink :to="{ name: 'login' }" class="btn btn-ghost hidden sm:inline-flex">{{ t('nav.signIn') }}</RouterLink>
            <RouterLink :to="{ name: 'register' }" class="btn btn-primary hidden sm:inline-flex">{{ t('nav.getStarted') }}</RouterLink>
          </template>
          <button class="btn-icon md:hidden" aria-label="Menu" @click="mobileOpen = !mobileOpen">
            <component :is="mobileOpen ? XMarkIcon : Bars3Icon" class="size-6" />
          </button>
        </div>
      </div>

      <Transition name="fade">
        <div v-if="mobileOpen" class="border-t border-slate-100 bg-white px-4 pt-2 pb-4 md:hidden">
          <RouterLink v-for="link in publicLinks" :key="link.key" :to="link.to" class="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-slate-700 hover:bg-slate-50">
            <component :is="link.icon" class="size-5 text-brand-600" /> {{ t(link.key) }}
          </RouterLink>
          <div class="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <LanguageToggle />
            <div v-if="!auth.isAuthenticated" class="flex gap-2">
              <RouterLink :to="{ name: 'login' }" class="btn btn-secondary btn-sm">{{ t('nav.signIn') }}</RouterLink>
              <RouterLink :to="{ name: 'register' }" class="btn btn-primary btn-sm">{{ t('nav.getStarted') }}</RouterLink>
            </div>
          </div>
        </div>
      </Transition>
    </header>

    <main class="flex-1" :class="!isHome && 'pb-16'">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <footer class="no-print relative overflow-hidden bg-brand-950 text-brand-100">
      <div class="tibeb h-3.5 opacity-80" />
      <div class="pattern-dots absolute inset-0 opacity-40" />
      <div class="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div class="lg:col-span-2">
          <AppLogo dark />
          <p class="mt-4 max-w-sm text-sm leading-relaxed text-brand-200/80">
            Ethiopia's pharmacy network. Find genuine, EFDA-registered medicines near you, compare prices in Birr,
            and fill prescriptions from your hospital in minutes.
          </p>
          <p class="mt-3 font-am text-sm text-gold-300">ጤናዎ የእኛ ጉዳይ ነው።</p>
        </div>
        <div>
          <h4 class="text-sm font-bold text-white">Patients</h4>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><RouterLink :to="{ name: 'search' }" class="hover:text-white">Find medicine</RouterLink></li>
            <li><RouterLink :to="{ name: 'pharmacies' }" class="hover:text-white">Pharmacy directory</RouterLink></li>
            <li><RouterLink :to="{ name: 'pharmacies.nearby' }" class="hover:text-white">Pharmacies near me</RouterLink></li>
            <li><RouterLink :to="{ name: 'prescription-check' }" class="hover:text-white">Check a prescription</RouterLink></li>
            <li><RouterLink :to="{ name: 'register' }" class="hover:text-white">Create an account</RouterLink></li>
          </ul>
        </div>
        <div>
          <h4 class="text-sm font-bold text-white">Healthcare providers</h4>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><RouterLink :to="{ name: 'register.organization', query: { type: 'pharmacy' } }" class="hover:text-white">Register a pharmacy</RouterLink></li>
            <li><RouterLink :to="{ name: 'register.organization', query: { type: 'hospital' } }" class="hover:text-white">Register a hospital / clinic</RouterLink></li>
            <li><RouterLink :to="{ name: 'login' }" class="hover:text-white">Staff sign in</RouterLink></li>
          </ul>
        </div>
        <div>
          <h4 class="text-sm font-bold text-white">Serving</h4>
          <p class="mt-4 text-sm leading-7 text-brand-200/80">Addis Ababa · Adama · Hawassa · Bahir Dar · Gondar · Mekelle · Dire Dawa · Jimma</p>
        </div>
      </div>
      <div class="relative border-t border-white/10">
        <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-brand-200/60 sm:flex-row sm:px-6">
          <p>© {{ new Date().getFullYear() }} MedLink Ethiopia. Prices in Ethiopian Birr (ETB).</p>
          <p>Always follow your health professional's advice. Prescription medicines are dispensed only against a valid prescription.</p>
        </div>
      </div>
    </footer>
  </div>
</template>
