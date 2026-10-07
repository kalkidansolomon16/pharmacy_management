<script setup>
import { CheckBadgeIcon, ClockIcon, ShieldCheckIcon } from '@heroicons/vue/24/solid'
import AppLogo from '@/components/ui/AppLogo.vue'
import LanguageToggle from '@/components/layout/LanguageToggle.vue'

const points = [
  { icon: CheckBadgeIcon, text: 'Only EFDA-licensed pharmacies, verified by our team' },
  { icon: ShieldCheckIcon, text: 'Prescriptions verified digitally - no lost paper slips' },
  { icon: ClockIcon, text: 'Expiry and stock alerts so nothing expired is ever sold' },
]
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-[1fr_minmax(0,46%)]">
    <section class="relative flex flex-col bg-white">
      <div class="flag-ribbon h-1" />
      <header class="flex items-center justify-between px-6 py-5 sm:px-10">
        <RouterLink to="/"><AppLogo /></RouterLink>
        <LanguageToggle />
      </header>
      <div class="flex flex-1 items-start justify-center px-6 pt-6 pb-12 sm:px-10 lg:items-center lg:pt-0">
        <div class="w-full max-w-lg animate-fade-up">
          <RouterView />
        </div>
      </div>
      <footer class="px-6 pb-6 text-xs text-slate-400 sm:px-10">© {{ new Date().getFullYear() }} MedLink Ethiopia · Addis Ababa</footer>
    </section>

    <aside class="relative hidden overflow-hidden bg-brand-950 lg:block">
      <img src="/images/beautiful-young-female-doctor-looking-camera-office_1301-7807.avif" alt="" class="absolute inset-0 size-full object-cover opacity-30 mix-blend-luminosity" />
      <div class="absolute inset-0 bg-gradient-to-br from-brand-900/95 via-brand-950/85 to-brand-950" />
      <div class="pattern-dots absolute inset-0" />
      <div class="absolute -top-24 -right-24 size-96 rounded-full bg-brand-500/20 blur-3xl" />
      <div class="absolute -bottom-32 -left-16 size-96 rounded-full bg-gold-400/10 blur-3xl" />

      <div class="relative flex h-full flex-col justify-between p-12 text-white xl:p-16">
        <div class="tibeb h-3 w-40 rounded-full opacity-90" />
        <div>
          <p class="font-am text-lg text-gold-300">ጤና ለሁሉም</p>
          <h2 class="mt-3 text-4xl leading-tight font-extrabold tracking-tight xl:text-5xl">
            Connecting Ethiopia's<br />pharmacies, hospitals<br />and patients.
          </h2>
          <ul class="mt-10 space-y-4">
            <li v-for="p in points" :key="p.text" class="flex items-center gap-3 text-brand-100">
              <span class="grid size-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15"><component :is="p.icon" class="size-5 text-gold-400" /></span>
              {{ p.text }}
            </li>
          </ul>
        </div>
        <figure class="glass rounded-3xl !border-white/10 !bg-white/5 p-6">
          <blockquote class="text-brand-50">
            “We used to throw away thousands of Birr of expired stock every quarter. Now the system tells us what to sell first.”
          </blockquote>
          <figcaption class="mt-4 flex items-center gap-3 text-sm">
            <span class="grid size-10 place-items-center rounded-full bg-gold-400 font-bold text-brand-950">TH</span>
            <span><b class="block text-white">Tigist Haile</b><span class="text-brand-200/70">Pharmacist, Bole, Addis Ababa</span></span>
          </figcaption>
        </figure>
      </div>
    </aside>
  </div>
</template>
