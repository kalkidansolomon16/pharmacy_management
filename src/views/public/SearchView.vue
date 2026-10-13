<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { AdjustmentsHorizontalIcon, ArrowTopRightOnSquareIcon, MapIcon, MapPinIcon, ShieldExclamationIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { useList } from '@/composables/useList'
import { useMetaStore } from '@/stores/meta'
import { money, number } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import SearchInput from '@/components/ui/SearchInput.vue'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import AddToCartButton from '@/components/public/AddToCartButton.vue'
import PharmaciesMap from '@/components/maps/PharmaciesMap.vue'
import CitySelect from '@/components/ui/CitySelect.vue'
import { useUserLocation } from '@/composables/useUserLocation'
import { directionsUrl, distanceLabel } from '@/lib/googleMaps'
import { useUiStore } from '@/stores/ui'

const meta = useMetaStore()
const { t } = useI18n()
const showFilters = ref(false)

// Near me: the user's coordinates go to the API but never into the page URL (shared links stay private)
const location = useUserLocation()
const ui = useUiStore()
const nearMe = ref(false)
const radius = ref(10)
const showMap = ref(false)
const selectedPharmacy = ref(null)
const searchUrl = () => {
  const p = location.position.value
  return nearMe.value && p ? `/public/medicines?${new URLSearchParams({ lat: p.lat.toFixed(5), lng: p.lng.toFixed(5), radius_km: radius.value })}` : '/public/medicines'
}

const { rows, meta: page, loading, filters, page: current, reload } = useList(searchUrl, {
  q: '', category: '', city: '', sub_city: '', min_price: '', max_price: '', rx: '', open_24: '', delivery: '', sort: 'relevance',
}, { perPage: 10 })

onMounted(() => meta.load())

async function toggleNearMe() {
  if (nearMe.value) {
    nearMe.value = false
    if (filters.sort === 'nearest') filters.sort = 'relevance'
    return reload()
  }
  try {
    await location.locate()
    nearMe.value = true
    filters.city = '' // distance replaces the city filter
    filters.sort = 'nearest'
    reload()
  } catch (e) {
    ui.error(e.message, 'Location')
  }
}
watch(radius, () => nearMe.value && reload())

/** Every pharmacy in the results, for the map (one pin each, with its cheapest matching item). */
const mapPharmacies = computed(() => {
  const byId = new Map()
  for (const m of rows.value) {
    for (const o of m.offers ?? []) {
      if (!byId.has(o.pharmacy.id)) byId.set(o.pharmacy.id, { ...o.pharmacy, label: `${m.generic_name} ${m.strength} · ${money(o.price)}` })
    }
  }
  return [...byId.values()]
})
const origin = computed(() => (nearMe.value && location.position.value ? { lat: location.position.value.lat, lng: location.position.value.lng } : null))

const bool = (key) => ({
  get: () => filters[key] === '1' || filters[key] === 1 || filters[key] === true,
  set: (v) => (filters[key] = v ? '1' : ''),
})
const open24 = computed(bool('open_24'))
const delivery = computed(bool('delivery'))

const activeCount = computed(() => ['category', 'city', 'sub_city', 'min_price', 'max_price', 'rx', 'open_24', 'delivery'].filter((k) => filters[k] !== '' && filters[k] !== undefined).length)

function clearFilters() {
  Object.assign(filters, { category: '', city: '', sub_city: '', min_price: '', max_price: '', rx: '', open_24: '', delivery: '' })
}

const stockLabel = (qty) => (qty > 50 ? 'Plenty in stock' : qty > 10 ? `${qty} left` : `Only ${qty} left`)
</script>

<template>
  <div>
    <section class="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-brand-50 to-white">
      <div class="pattern-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div class="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">{{ t('nav.findMedicine') }}</h1>
        <p class="mt-1 text-slate-500">Live stock and prices from verified pharmacies. Expired stock is never shown.</p>
        <div class="mt-6 flex flex-col gap-3 sm:flex-row">
          <SearchInput v-model="filters.q" class="flex-1 [&_input]:h-12 [&_input]:text-base" :placeholder="t('hero.searchPlaceholder')" />
          <CitySelect v-if="!nearMe" v-model="filters.city" class="sm:w-52" :any-label="t('hero.anyCity')" />
          <button class="btn h-12 shrink-0" :class="nearMe ? 'btn-primary' : 'btn-secondary'" :disabled="location.locating.value" @click="toggleNearMe">
            <MapPinIcon class="size-5" /> {{ location.locating.value ? 'Locating…' : nearMe ? 'Near me ✓' : 'Near me' }}
          </button>
          <select v-model="filters.sort" class="input h-12 sm:w-48">
            <option v-if="nearMe" value="nearest">Nearest first</option>
            <option value="relevance">Sort: A–Z</option>
            <option value="price_asc">Lowest price</option>
            <option value="price_desc">Highest price</option>
            <option value="pharmacies">Most available</option>
          </select>
          <button class="btn btn-secondary h-12 lg:hidden" @click="showFilters = !showFilters">
            <AdjustmentsHorizontalIcon class="size-5" /> {{ t('common.filters') }} <span v-if="activeCount" class="chip bg-brand-600 text-white ring-0">{{ activeCount }}</span>
          </button>
        </div>
        <div v-if="nearMe" class="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span class="chip bg-brand-50 text-brand-800 ring-brand-600/15"><MapPinIcon class="size-3.5" /> Pharmacies near your location</span>
          <select v-model.number="radius" class="input h-9 w-auto py-1 text-sm">
            <option v-for="km in [2, 5, 10, 25, 50]" :key="km" :value="km">within {{ km }} km</option>
          </select>
          <button class="btn btn-ghost btn-sm" @click="showMap = !showMap"><MapIcon class="size-4" /> {{ showMap ? 'Hide map' : 'Show map' }}</button>
        </div>
        <div v-else class="mt-3">
          <button class="btn btn-ghost btn-sm px-0 text-brand-700" @click="showMap = !showMap"><MapIcon class="size-4" /> {{ showMap ? 'Hide map' : 'See these pharmacies on a map' }}</button>
        </div>
      </div>
    </section>

    <div class="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[16rem_1fr]">
      <!-- Filters -->
      <aside class="space-y-6 lg:block" :class="showFilters ? 'block' : 'hidden'">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-bold text-slate-900">{{ t('common.filters') }}</h2>
          <button v-if="activeCount" class="text-xs font-semibold text-brand-700 hover:underline" @click="clearFilters">Clear all</button>
        </div>

        <div>
          <p class="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Category</p>
          <div class="space-y-1">
            <button class="w-full rounded-lg px-3 py-1.5 text-left text-sm transition" :class="!filters.category ? 'bg-brand-600 font-semibold text-white' : 'text-slate-600 hover:bg-slate-100'" @click="filters.category = ''">All categories</button>
            <button
              v-for="c in meta.categories"
              :key="c.id"
              class="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition"
              :class="filters.category === c.slug ? 'bg-brand-600 font-semibold text-white' : 'text-slate-600 hover:bg-slate-100'"
              @click="filters.category = c.slug"
            >
              <span class="truncate">{{ c.name }}</span>
              <span class="text-xs opacity-60">{{ c.medicines_count }}</span>
            </button>
          </div>
        </div>

        <div v-if="filters.city === 'Addis Ababa'">
          <p class="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Sub-city (ክፍለ ከተማ)</p>
          <select v-model="filters.sub_city" class="input">
            <option value="">All sub-cities</option>
            <option v-for="s in meta.subCities" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div>
          <p class="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Price per unit (ETB)</p>
          <div class="flex items-center gap-2">
            <input v-model="filters.min_price" type="number" min="0" class="input" placeholder="Min" />
            <span class="text-slate-400">–</span>
            <input v-model="filters.max_price" type="number" min="0" class="input" placeholder="Max" />
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Type</p>
          <div class="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button v-for="o in [{ v: '', l: 'All' }, { v: '0', l: 'OTC' }, { v: '1', l: 'Rx only' }]" :key="o.v" class="rounded-lg py-1.5 transition" :class="String(filters.rx) === o.v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'" @click="filters.rx = o.v">{{ o.l }}</button>
          </div>
        </div>

        <div class="card space-y-4 p-4">
          <ToggleSwitch v-model="open24" label="Open 24 hours" description="Night & weekend pharmacies" />
          <ToggleSwitch v-model="delivery" label="Offers delivery" description="Get it brought to you" />
        </div>
      </aside>

      <!-- Results -->
      <section>
        <div class="mb-4 flex items-center justify-between text-sm text-slate-500">
          <p><b class="text-slate-900">{{ number(page.total) }}</b> {{ page.total === 1 ? 'medicine' : 'medicines' }} found</p>
          <p v-if="loading" class="animate-pulse text-brand-700">Updating…</p>
        </div>

        <div v-if="showMap" class="card mb-5 h-80 overflow-hidden sm:h-96">
          <PharmaciesMap :pharmacies="mapPharmacies" :origin="origin" :selected-id="selectedPharmacy" @select="(p) => (selectedPharmacy = p.id)" />
        </div>

        <div class="space-y-4" :class="loading && rows.length && 'opacity-60 transition'">
          <template v-if="loading && !rows.length">
            <div v-for="i in 4" :key="i" class="skeleton h-48 rounded-2xl" />
          </template>

          <article v-for="m in rows" :key="m.id" class="card overflow-hidden animate-fade-up">
            <div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              <MedicineAvatar :form="m.dosage_form" size="lg" />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-lg font-bold text-slate-900">{{ m.generic_name }} <span class="font-semibold text-slate-500">{{ m.strength }}</span></h3>
                  <span v-if="m.prescription_required" class="chip bg-rose-50 text-rose-700 ring-rose-600/15"><ShieldExclamationIcon class="size-3.5" /> Rx</span>
                  <span v-else class="chip bg-emerald-50 text-emerald-700 ring-emerald-600/15">OTC</span>
                </div>
                <p class="mt-0.5 text-sm text-slate-500">
                  {{ m.dosage_form }}<template v-if="m.brand_name"> · {{ m.brand_name }}</template><template v-if="m.manufacturer"> · {{ m.manufacturer }}</template>
                </p>
                <p v-if="m.category" class="mt-1 text-xs font-semibold text-brand-700">{{ m.category.name }} <span class="font-am font-normal text-slate-400">{{ m.category.name_am }}</span></p>
              </div>
              <div class="shrink-0 text-left sm:text-right">
                <p class="text-xs font-semibold text-slate-500">per {{ m.unit }}</p>
                <p class="text-xl font-extrabold text-slate-900">{{ money(m.min_price) }}</p>
                <p v-if="m.max_price > m.min_price" class="text-xs text-slate-500">up to {{ money(m.max_price) }}</p>
                <p class="mt-1 text-xs font-semibold text-brand-700">{{ m.pharmacies_count }} {{ m.pharmacies_count === 1 ? 'pharmacy' : 'pharmacies' }}</p>
                <p v-if="m.nearest_km != null" class="text-xs font-bold text-sky-700">nearest {{ distanceLabel(m.nearest_km) }} away</p>
              </div>
            </div>
            <ul class="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/50">
              <li v-for="o in m.offers" :key="o.pharmacy_medicine_id" class="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
                <RouterLink :to="{ name: 'pharmacy', params: { slug: o.pharmacy.slug } }" class="min-w-0 flex-1 group">
                  <p class="truncate text-sm font-semibold text-slate-800 group-hover:text-brand-700">{{ o.pharmacy.name }}</p>
                  <p class="flex items-center gap-1 text-xs text-slate-500">
                    <MapPinIcon class="size-3.5" /> {{ [o.pharmacy.sub_city, o.pharmacy.city].filter(Boolean).join(', ') }}
                    <span v-if="o.pharmacy.is_24_hours" class="ml-1 rounded bg-gold-100 px-1 font-bold text-amber-700">24/7</span>
                    <span v-if="o.pharmacy.delivery_available" class="ml-1 rounded bg-brand-100 px-1 font-bold text-brand-700">Delivery</span>
                  </p>
                </RouterLink>
                <span v-if="o.pharmacy.distance_km != null" class="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">{{ distanceLabel(o.pharmacy.distance_km) }}</span>
                <a v-if="o.pharmacy.latitude" :href="directionsUrl(o.pharmacy, origin)" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline">Directions <ArrowTopRightOnSquareIcon class="size-3" /></a>
                <span class="text-xs font-semibold" :class="o.available_quantity > 10 ? 'text-emerald-600' : 'text-amber-600'">● {{ stockLabel(o.available_quantity) }}</span>
                <span class="w-28 text-sm font-bold text-slate-900 sm:text-right">{{ money(o.price) }}</span>
                <AddToCartButton :listing-id="o.pharmacy_medicine_id" :price="o.price" :available="o.available_quantity" :medicine="m" :pharmacy="o.pharmacy" />
              </li>
            </ul>
          </article>

          <div v-if="!loading && !rows.length" class="card py-16">
            <EmptyState title="No medicines match your search" :text="nearMe ? `Nothing within ${radius} km of you. Try a larger distance, or turn off Near me.` : 'Try another spelling, a generic name (e.g. “Paracetamol” instead of a brand), or remove some filters.'">
              <button v-if="activeCount" class="btn btn-secondary btn-sm" @click="clearFilters"><XMarkIcon class="size-4" /> Clear filters</button>
            </EmptyState>
          </div>
        </div>

        <div class="card mt-6 overflow-hidden"><AppPagination v-model="current" :meta="page" /></div>
      </section>
    </div>
  </div>
</template>
