<script setup>
import { ClockIcon, MapPinIcon, PhoneIcon, TruckIcon } from '@heroicons/vue/24/outline'
import { phone } from '@/lib/format'

defineProps({ pharmacy: { type: Object, required: true } })

/** Deterministic accent per pharmacy so the directory feels varied. */
const accents = ['from-brand-500 to-brand-800', 'from-teal-500 to-cyan-700', 'from-gold-400 to-amber-600', 'from-emerald-500 to-green-800', 'from-sky-500 to-indigo-700']
const accent = (p) => accents[p.id % accents.length]
</script>

<template>
  <RouterLink :to="{ name: 'pharmacy', params: { slug: pharmacy.slug } }" class="card card-hover group flex flex-col overflow-hidden">
    <div class="relative h-24 bg-gradient-to-br" :class="accent(pharmacy)">
      <div class="pattern-dots absolute inset-0" />
      <div class="absolute right-4 bottom-0 left-4 flex translate-y-1/2 items-end justify-between">
        <span class="grid size-14 place-items-center rounded-2xl bg-white text-xl font-extrabold text-brand-700 shadow-lg ring-4 ring-white">
          {{ pharmacy.name.charAt(0) }}
        </span>
        <div class="mb-9 flex gap-1.5">
          <span v-if="pharmacy.distance_km != null" class="chip bg-sky-600 text-white ring-sky-700/30">{{ pharmacy.distance_km < 1 ? Math.round(pharmacy.distance_km * 1000) + ' m' : pharmacy.distance_km.toFixed(1) + ' km' }}</span>
          <span v-if="pharmacy.is_24_hours" class="chip bg-gold-400 text-brand-950 ring-gold-500/30">24/7</span>
          <span v-if="pharmacy.delivery_available" class="chip bg-white/90 text-brand-800 ring-white"><TruckIcon class="size-3.5" /> Delivery</span>
        </div>
      </div>
    </div>
    <div class="flex flex-1 flex-col p-5 pt-10">
      <h3 class="font-bold text-slate-900 transition group-hover:text-brand-700">{{ pharmacy.name }}</h3>
      <p class="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
        <MapPinIcon class="mt-0.5 size-4 shrink-0 text-brand-500" />
        <span>{{ [pharmacy.sub_city, pharmacy.city].filter(Boolean).join(', ') }}<template v-if="pharmacy.woreda"> · Woreda {{ pharmacy.woreda }}</template></span>
      </p>
      <p v-if="pharmacy.address_line" class="mt-0.5 line-clamp-1 pl-5.5 text-xs text-slate-400">{{ pharmacy.address_line }}</p>
      <div class="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span class="flex items-center gap-1"><ClockIcon class="size-3.5" /> {{ pharmacy.is_24_hours ? 'Open 24 hours' : 'Mon-Sat' }}</span>
        <span class="flex items-center gap-1"><PhoneIcon class="size-3.5" /> {{ phone(pharmacy.phone) }}</span>
      </div>
      <p v-if="pharmacy.medicines_count !== undefined" class="mt-2 text-xs font-semibold text-brand-700">{{ pharmacy.medicines_count }} medicines listed</p>
    </div>
  </RouterLink>
</template>
