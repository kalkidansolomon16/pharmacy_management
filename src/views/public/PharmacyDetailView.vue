<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ClockIcon, EnvelopeIcon, MapIcon, MapPinIcon, PhoneIcon, TruckIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money, phone } from '@/lib/format'
import { directionsUrl, distanceLabel, placeUrl } from '@/lib/googleMaps'
import { Geo } from '@/lib/geo'
import PharmaciesMap from '@/components/maps/PharmaciesMap.vue'
import { useUserLocation } from '@/composables/useUserLocation'
import { useList } from '@/composables/useList'
import { useMetaStore } from '@/stores/meta'
import SearchInput from '@/components/ui/SearchInput.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AddToCartButton from '@/components/public/AddToCartButton.vue'

const route = useRoute()
const meta = useMetaStore()
const pharmacy = ref(null)
const notFound = ref(false)

const { rows, meta: page, loading, filters, page: current } = useList(`/public/pharmacies/${route.params.slug}/medicines`, { q: '', category: '', in_stock: '1' }, { perPage: 24 })

onMounted(async () => {
  meta.load()
  try {
    pharmacy.value = (await api.get(`/public/pharmacies/${route.params.slug}`)).data.data
    document.title = `${pharmacy.value.name} · MedLink Ethiopia`
  } catch {
    notFound.value = true
  }
})

const mapUrl = computed(() => pharmacy.value?.latitude ? placeUrl(pharmacy.value.latitude, pharmacy.value.longitude) : null)
const location = useUserLocation()
const distance = computed(() => (pharmacy.value?.latitude && location.position.value ? Geo.distanceKm(location.position.value, { lat: Number(pharmacy.value.latitude), lng: Number(pharmacy.value.longitude) }) : null))
const directions = computed(() => (pharmacy.value?.latitude ? directionsUrl(pharmacy.value, location.position.value) : null))
const inStockOnly = computed({ get: () => filters.in_stock === '1', set: (v) => (filters.in_stock = v ? '1' : '') })
</script>

<template>
  <div v-if="notFound" class="mx-auto max-w-xl px-4 py-24"><EmptyState title="Pharmacy not found" text="It may have moved or is no longer listed."><RouterLink :to="{ name: 'pharmacies' }" class="btn btn-primary">Browse pharmacies</RouterLink></EmptyState></div>
  <div v-else>
    <section class="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 text-white">
      <div class="pattern-dots absolute inset-0" />
      <div class="relative mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <RouterLink :to="{ name: 'pharmacies' }" class="text-sm font-semibold text-brand-200 hover:text-white">← All pharmacies</RouterLink>
        <div v-if="pharmacy" class="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div class="flex items-center gap-5">
            <span class="grid size-20 shrink-0 place-items-center rounded-3xl bg-white text-3xl font-extrabold text-brand-700 shadow-xl">{{ pharmacy.name.charAt(0) }}</span>
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ pharmacy.name }}</h1>
              <p class="mt-1 flex items-center gap-1.5 text-brand-100/80"><MapPinIcon class="size-4.5" /> {{ [pharmacy.address_line, pharmacy.sub_city, pharmacy.city].filter(Boolean).join(', ') }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span class="chip bg-white/10 text-white ring-white/20"><ClockIcon class="size-3.5" /> {{ pharmacy.opening_hours || 'Call for hours' }}</span>
                <span v-if="pharmacy.is_24_hours" class="chip bg-gold-400 text-brand-950 ring-gold-400">Open 24/7</span>
                <span v-if="pharmacy.delivery_available" class="chip bg-white text-brand-800 ring-white"><TruckIcon class="size-3.5" /> Delivers</span>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <a :href="`tel:${pharmacy.phone}`" class="btn btn-gold"><PhoneIcon class="size-4" /> {{ phone(pharmacy.phone) }}</a>
            <a v-if="mapUrl" :href="mapUrl" target="_blank" rel="noopener" class="btn border border-white/25 text-white hover:bg-white/10"><MapIcon class="size-4" /> Map</a>
            <a v-if="directions" :href="directions" target="_blank" rel="noopener" class="btn border border-white/25 text-white hover:bg-white/10">Directions ↗</a>
          </div>
        </div>
        <div v-else class="mt-6 h-24 w-2/3 animate-pulse rounded-3xl bg-white/10" />
        <p v-if="pharmacy?.description" class="mt-6 max-w-3xl text-sm text-brand-100/75">{{ pharmacy.description }}</p>
      </div>
    </section>

    <section v-if="pharmacy?.latitude" class="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <div class="card overflow-hidden">
        <div class="h-64 sm:h-72"><PharmaciesMap :pharmacies="[{ ...pharmacy, distance_km: distance }]" :origin="location.position.value ? { lat: location.position.value.lat, lng: location.position.value.lng } : null" /></div>
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
          <span class="flex items-center gap-1.5 text-slate-600"><MapPinIcon class="size-4 text-brand-600" /> {{ [pharmacy.address_line, pharmacy.sub_city, pharmacy.city].filter(Boolean).join(', ') }}</span>
          <span class="flex items-center gap-3">
            <span v-if="distance !== null" class="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700">{{ distanceLabel(distance) }} from you</span>
            <button v-else class="text-xs font-semibold text-brand-700 hover:underline" @click="location.locate().catch(() => {})">How far is it from me?</button>
            <a :href="directions" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Get directions ↗</a>
          </span>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div class="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput v-model="filters.q" class="flex-1" placeholder="Search this pharmacy's medicines…" />
        <select v-model="filters.category" class="input md:w-60">
          <option value="">All categories</option>
          <option v-for="c in meta.categories" :key="c.id" :value="c.slug">{{ c.name }}</option>
        </select>
        <label class="flex items-center gap-2 text-sm font-semibold text-slate-600"><input v-model="inStockOnly" type="checkbox" class="size-4 rounded accent-brand-600" /> In stock only</label>
      </div>

      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <template v-if="loading && !rows.length"><div v-for="i in 8" :key="i" class="skeleton h-44 rounded-2xl" /></template>
        <article v-for="l in rows" :key="l.id" class="card card-hover flex flex-col p-4">
          <div class="flex items-start gap-3">
            <MedicineAvatar :form="l.medicine.dosage_form" />
            <div class="min-w-0">
              <h3 class="truncate font-bold text-slate-900" :title="l.medicine.display_name">{{ l.medicine.generic_name }}</h3>
              <p class="truncate text-xs text-slate-500">{{ l.medicine.strength }} · {{ l.medicine.dosage_form }}</p>
              <p v-if="l.medicine.brand_name" class="truncate text-xs text-slate-400">{{ l.medicine.brand_name }}</p>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span v-if="l.medicine.prescription_required" class="chip bg-rose-50 text-rose-700 ring-rose-600/15">Rx</span>
            <span v-if="l.stock_status === 'out_of_stock'" class="chip bg-slate-100 text-slate-500 ring-slate-300">Out of stock</span>
            <span v-else-if="l.available_quantity <= 10" class="chip bg-amber-50 text-amber-700 ring-amber-600/20">Only {{ l.available_quantity }} left</span>
            <span v-else class="chip bg-emerald-50 text-emerald-700 ring-emerald-600/15">In stock</span>
          </div>
          <div class="mt-auto flex items-end justify-between pt-4">
            <div>
              <p class="text-lg font-extrabold text-slate-900">{{ money(l.price) }}</p>
              <p class="text-[0.7rem] text-slate-400">per {{ l.medicine.unit }}</p>
            </div>
            <AddToCartButton v-if="pharmacy" :listing-id="l.id" :price="l.price" :available="l.available_quantity" :medicine="l.medicine" :pharmacy="pharmacy" />
          </div>
        </article>
      </div>
      <div v-if="!loading && !rows.length" class="card py-16"><EmptyState title="No medicines match" text="Try a different name or category." /></div>
      <div class="card mt-6 overflow-hidden"><AppPagination v-model="current" :meta="page" /></div>
    </section>
  </div>
</template>
