<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowTopRightOnSquareIcon, BeakerIcon, ClockIcon, HeartIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon, TruckIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { phone } from '@/lib/format'
import { MAP_ID, directionsUrl, distanceLabel, hasGoogleMapsKey, loadGoogleMaps } from '@/lib/googleMaps'
import EmptyState from '@/components/ui/EmptyState.vue'
import PharmaciesMap from '@/components/maps/PharmaciesMap.vue'

const ADDIS = { lat: 9.0108, lng: 38.7613 } // Meskel Square, until we know where the user is
const RADII = [1, 2, 5, 10, 25]

const router = useRouter()
const route = useRoute()

// Two separate categories, never mixed in one list (?type=hospital links straight to hospitals)
const TYPES = [
  { value: 'pharmacy', label: '💊 Pharmacies' },
  { value: 'hospital', label: '🏥 Hospitals & clinics' },
]
const type = ref(TYPES.some((t) => t.value === route.query.type) ? route.query.type : 'pharmacy')
const SERVICE_LABELS = { emergency: 'Emergency 24/7', opd: 'Outpatient (OPD)', laboratory: 'Laboratory', pharmacy: 'In-house pharmacy', insurance: 'Accepts insurance / CBHI' }
const isHospital = (p) => p.type === 'hospital'

const origin = ref(null) // { lat, lng } the search is centred on
const locationSource = ref('pending') // pending | gps | manual | default
const locationError = ref('')
const radius = ref(5)
const open24 = ref(false)
const delivery = ref(false)

const pharmacies = ref([])
const loading = ref(false)
const loadError = ref('')
const selectedId = ref(null)

const mapEl = ref(null)
const listEl = ref(null)
const mapError = ref(hasGoogleMapsKey ? '' : 'missing-key')
const mapReady = ref(false)

// Google Maps objects stay outside Vue's reactivity
let lib = null
let map = null
let youMarker = null
let circle = null
let infoWindow = null
const markers = new Map() // pharmacy id -> { marker, dot }
let refit = true // re-frame the map after the next search

/* ------------------------------------------------------------ location */

function setOrigin(point, source) {
  origin.value = { lat: point.lat, lng: point.lng }
  locationSource.value = source
  refit = source !== 'manual' // keep the map still while the user is placing the pin
  syncOriginOnMap()
}

function locate() {
  const previous = origin.value ? { point: origin.value, source: locationSource.value } : null
  const fail = (reason) => {
    locationError.value = reason
    if (previous) setOrigin(previous.point, previous.source)
    else setOrigin(ADDIS, 'default')
  }
  if (!navigator.geolocation) return fail('Your browser cannot share its location')

  locationSource.value = 'pending'
  locationError.value = ''
  navigator.geolocation.getCurrentPosition(
    (pos) => setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'gps'),
    (err) => fail(err.code === err.PERMISSION_DENIED ? 'Location access was blocked' : 'We could not find your location'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  )
}

const locationText = computed(() => {
  switch (locationSource.value) {
    case 'pending': return 'Finding your location…'
    case 'gps': return 'Showing pharmacies near your current location.'
    case 'manual': return 'Showing pharmacies near the pin you placed.'
    default:
      return mapReady.value || mapError.value // either map lets the user tap / drag to place themselves
        ? `${locationError.value}. Showing central Addis Ababa — tap the map or drag the blue pin to where you are.`
        : `${locationError.value}. Showing central Addis Ababa — allow location access and press "Use my location".`
  }
})

/* -------------------------------------------------------------- search */

let requestId = 0
async function search() {
  if (!origin.value) return
  const id = ++requestId
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/public/facilities/nearby', {
      params: {
        type: type.value,
        lat: origin.value.lat.toFixed(6),
        lng: origin.value.lng.toFixed(6),
        radius_km: radius.value,
        open_24: open24.value ? 1 : undefined,
        delivery: delivery.value ? 1 : undefined,
        specialty: type.value === 'hospital' && specialty.value ? specialty.value : undefined,
      },
    })
    if (id !== requestId) return // a newer search already started
    pharmacies.value = data.data
    if (!pharmacies.value.some((p) => p.id === selectedId.value)) closeInfo()
    renderMarkers()
    if (refit) frameSearchArea()
  } catch (error) {
    if (id === requestId) loadError.value = error.message || 'Could not load nearby pharmacies.'
  } finally {
    if (id === requestId) loading.value = false
  }
}

// Hospital specialties (Orthopedics & Spine, Cardiology...) - the list is managed by the MedLink team
const specialty = ref(typeof route.query.specialty === 'string' ? route.query.specialty : '')
const specialties = ref([])
api.get('/public/specialties').then(({ data }) => (specialties.value = data.data)).catch(() => {})
watch(specialty, (slug) => router.replace({ query: { ...route.query, specialty: slug || undefined } }).catch(() => {}))

watch([origin, radius, open24, delivery, type, specialty], search)
watch(type, (t) => {
  router.replace({ query: { ...route.query, type: t === 'pharmacy' ? undefined : t } }).catch(() => {})
  if (t === 'hospital') delivery.value = false // delivery is a pharmacy service
})
watch(radius, (km) => {
  circle?.setRadius(km * 1000)
  refit = true
})

/* ----------------------------------------------------------------- map */

const el = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function youDot() {
  const dot = el('div', 'relative grid size-6 place-items-center')
  dot.append(el('span', 'absolute inset-0 animate-ping rounded-full bg-sky-400/50'), el('span', 'relative size-4 rounded-full border-[3px] border-white bg-sky-600 shadow-lg'))
  return dot
}

function pharmacyDot(p) {
  // Pharmacies: green "+"; hospitals & clinics: red "H"
  const dot = el('div', `grid size-8 cursor-pointer place-items-center rounded-full border-2 border-white text-lg font-black leading-none text-white shadow-lg transition-transform ${isHospital(p) ? 'bg-rose-600' : 'bg-brand-700'}`, isHospital(p) ? 'H' : '+')
  dot.dataset.base = isHospital(p) ? 'bg-rose-600' : 'bg-brand-700'
  return dot
}

function infoContent(p) {
  const root = el('div', 'max-w-64 space-y-1.5 p-1 text-sm text-slate-600')
  root.append(el('p', 'text-base font-bold text-slate-900', p.name))
  root.append(el('p', 'font-semibold text-brand-700', `${distanceLabel(p.distance_km)} away`))
  const place = [p.address_line, p.sub_city, p.city].filter(Boolean).join(', ')
  if (place) root.append(el('p', '', place))
  const tags = isHospital(p)
    ? (p.services ?? []).map((s) => SERVICE_LABELS[s]).filter(Boolean)
    : [p.is_24_hours && 'Open 24 hours', p.delivery_available && 'Delivery'].filter(Boolean)
  if (tags.length) root.append(el('p', 'text-xs font-semibold text-slate-500', tags.join(' · ')))

  const actions = el('div', 'flex flex-wrap gap-3 pt-1 font-semibold')
  const view = el('a', 'text-brand-700 hover:underline', 'View medicines')
  view.href = router.resolve({ name: 'pharmacy', params: { slug: p.slug } }).href
  view.addEventListener('click', (event) => {
    event.preventDefault()
    router.push({ name: 'pharmacy', params: { slug: p.slug } })
  })
  const directions = el('a', 'text-sky-700 hover:underline', 'Directions ↗')
  directions.href = directionsUrl(p, origin.value)
  directions.target = '_blank'
  directions.rel = 'noopener'
  if (isHospital(p)) actions.append(directions)
  else actions.append(view, directions)
  if (p.phone) {
    const call = el('a', 'text-slate-700 hover:underline', 'Call')
    call.href = `tel:${p.phone}`
    actions.append(call)
  }
  root.append(actions)
  return root
}

function syncOriginOnMap() {
  if (!map || !origin.value) return
  youMarker.position = origin.value
  circle.setCenter(origin.value)
}

function frameSearchArea() {
  if (map && circle) map.fitBounds(circle.getBounds(), 24)
}

function renderMarkers() {
  if (!map) return
  for (const { marker } of markers.values()) marker.map = null
  markers.clear()
  for (const p of pharmacies.value) {
    const dot = pharmacyDot(p)
    const marker = new lib.AdvancedMarkerElement({ map, position: { lat: p.latitude, lng: p.longitude }, content: dot, title: p.name })
    marker.addEventListener('gmp-click', () => select(p, { fromMap: true }))
    markers.set(p.id, { marker, dot })
  }
  highlightSelected()
}

function highlightSelected() {
  for (const [id, { marker, dot }] of markers) {
    const active = id === selectedId.value
    dot.classList.toggle('scale-125', active)
    dot.classList.toggle('bg-gold-500', active)
    dot.classList.toggle(dot.dataset.base, !active)
    marker.zIndex = active ? 999 : null
  }
}

function closeInfo() {
  selectedId.value = null
  infoWindow?.close()
  highlightSelected()
}

async function select(p, { fromMap = false } = {}) {
  selectedId.value = p.id
  highlightSelected()
  const entry = markers.get(p.id)
  if (map && entry) {
    infoWindow.setContent(infoContent(p))
    infoWindow.open({ map, anchor: entry.marker })
    if (!fromMap) map.panTo({ lat: p.latitude, lng: p.longitude })
  }
  if (fromMap) {
    await nextTick()
    listEl.value?.querySelector(`[data-id="${p.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

async function initMap() {
  try {
    const maps = await loadGoogleMaps()
    const [{ Map, InfoWindow, Circle }, { AdvancedMarkerElement }] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')])
    if (!mapEl.value) return // left the page while loading
    lib = { AdvancedMarkerElement }

    const center = origin.value ?? ADDIS
    map = new Map(mapEl.value, {
      center,
      zoom: 13,
      mapId: MAP_ID,
      clickableIcons: false,
      streetViewControl: false,
      mapTypeControl: false,
      gestureHandling: 'cooperative', // two fingers to pan on phones, so the page still scrolls
    })
    infoWindow = new InfoWindow()
    infoWindow.addListener('closeclick', closeInfo)
    circle = new Circle({
      map, center, radius: radius.value * 1000, clickable: false,
      strokeColor: '#059669', strokeOpacity: 0.6, strokeWeight: 1, fillColor: '#10b981', fillOpacity: 0.06,
    })
    youMarker = new AdvancedMarkerElement({ map, position: center, content: youDot(), gmpDraggable: true, title: 'You are here — drag to move', zIndex: 1000 })
    youMarker.addListener('dragend', () => {
      const p = youMarker.position
      setOrigin({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng }, 'manual')
    })
    map.addListener('click', (event) => setOrigin({ lat: event.latLng.lat(), lng: event.latLng.lng() }, 'manual'))

    mapReady.value = true
    syncOriginOnMap()
    renderMarkers()
    frameSearchArea()
  } catch (error) {
    mapError.value = error.message
  }
}

const onAuthFailure = () => (mapError.value = 'auth')

onMounted(() => {
  locate()
  if (hasGoogleMapsKey) {
    window.addEventListener('google-maps-auth-failure', onAuthFailure)
    initMap()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('google-maps-auth-failure', onAuthFailure)
  for (const { marker } of markers.values()) marker.map = null
  if (youMarker) youMarker.map = null
  circle?.setMap(null)
  infoWindow?.close()
})

const mapErrorText = computed(() => {
  if (mapError.value === 'missing-key') {
    return import.meta.env.DEV
      ? 'Add VITE_GOOGLE_MAPS_API_KEY to .env.local and restart the dev server to show the map.'
      : 'The map is not available right now — the list below still shows pharmacies near you.'
  }
  if (mapError.value === 'auth') {
    return import.meta.env.DEV
      ? 'Google rejected the Maps API key. Check that the Maps JavaScript API is enabled, billing is on, and this domain is allowed for the key.'
      : 'The map is not available right now — the list still shows pharmacies near you.'
  }
  return mapError.value
})
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-brand-950 text-white">
      <div class="pattern-dots absolute inset-0" />
      <div class="absolute -top-24 right-0 size-96 rounded-full bg-brand-500/25 blur-3xl" />
      <div class="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p class="font-am text-gold-300">{{ type === 'hospital' ? 'በአቅራቢያዎ ያሉ ሆስፒታሎችና ክሊኒኮች' : 'በአቅራቢያዎ ያሉ ፋርማሲዎች' }}</p>
        <h1 class="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{{ type === 'hospital' ? 'Hospitals & clinics near you' : 'Pharmacies near you' }}</h1>
        <p class="mt-2 max-w-2xl text-brand-100/75">{{ type === 'hospital' ? 'Registered hospitals and clinics' : 'Registered pharmacies' }} around your location, nearest first. Switch category below. In an emergency call <b class="text-white">907</b> for an ambulance.</p>

        <div class="mt-5 inline-flex rounded-2xl bg-white/10 p-1 ring-1 ring-white/15" role="tablist">
          <button
            v-for="t in TYPES"
            :key="t.value"
            role="tab"
            :aria-selected="type === t.value"
            class="rounded-xl px-4 py-2 text-sm font-bold transition"
            :class="type === t.value ? 'bg-white text-brand-900 shadow' : 'text-white/80 hover:text-white'"
            @click="type = t.value"
          >
            {{ t.label }}
          </button>
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-2">
          <button class="btn btn-gold" :disabled="locationSource === 'pending'" @click="locate">
            <MapPinIcon class="size-5" /> {{ locationSource === 'pending' ? 'Locating…' : 'Use my location' }}
          </button>
          <label class="sr-only" for="nearby-radius">Search radius</label>
          <select id="nearby-radius" v-model.number="radius" class="input h-11 w-auto">
            <option v-for="km in RADII" :key="km" :value="km">Within {{ km }} km</option>
          </select>
          <button class="chip px-3.5 py-1.5 text-sm" :class="open24 ? 'bg-gold-400 text-brand-950 ring-gold-400' : 'bg-white/5 text-white ring-white/20'" @click="open24 = !open24">🌙 Open 24 hours</button>
          <button class="chip px-3.5 py-1.5 text-sm" :class="delivery ? 'bg-gold-400 text-brand-950 ring-gold-400' : 'bg-white/5 text-white ring-white/20'" @click="delivery = !delivery" v-if="type !== 'hospital'">🛵 Delivery available</button>
          <template v-if="type === 'hospital' && specialties.length">
            <label class="sr-only" for="nearby-specialty">Specialty</label>
            <select id="nearby-specialty" v-model="specialty" class="input h-11 w-auto max-w-[16rem]">
              <option value="">All specialties</option>
              <option v-for="s in specialties" :key="s.id" :value="s.slug">{{ s.name }}{{ s.hospitals_count ? ` (${s.hospitals_count})` : '' }}</option>
            </select>
          </template>
        </div>
        <p class="mt-3 text-sm text-brand-100/80" aria-live="polite">{{ locationText }}</p>
      </div>
    </section>

    <section class="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_24rem]">
      <div class="card relative h-80 overflow-hidden sm:h-[28rem] lg:h-[36rem]">
        <div v-show="!mapError" ref="mapEl" class="size-full" />
        <div v-if="!mapError && !mapReady" class="skeleton absolute inset-0" />
        <!-- No Google Maps key (or it was rejected): the free OpenStreetMap map, same pins, radius and draggable "you" -->
        <PharmaciesMap
          v-if="mapError && origin"
          :pharmacies="pharmacies"
          :origin="origin"
          :radius-km="radius"
          :selected-id="selectedId"
          pickable
          @select="(p) => select(p, { fromMap: true })"
          @pick="(point) => setOrigin(point, 'manual')"
        />
        <div v-else-if="mapError" class="grid size-full place-items-center bg-slate-50 p-6 text-center">
          <div>
            <MapPinIcon class="mx-auto size-10 text-slate-300" />
            <p class="mt-2 font-semibold text-slate-700">Map unavailable</p>
            <p class="mt-1 max-w-sm text-sm text-slate-500">{{ mapErrorText }}</p>
          </div>
        </div>
      </div>

      <div ref="listEl" class="space-y-3 lg:h-[36rem] lg:overflow-y-auto lg:pr-1">
        <p class="text-sm text-slate-500">
          <template v-if="loading && !pharmacies.length">Searching…</template>
          <template v-else><b class="text-slate-900">{{ pharmacies.length }}</b> {{ type === 'hospital' ? (pharmacies.length === 1 ? 'hospital / clinic' : 'hospitals & clinics') : (pharmacies.length === 1 ? 'pharmacy' : 'pharmacies') }} within {{ radius }} km</template>
        </p>

        <div v-if="loadError" class="card card-pad text-sm text-red-700">{{ loadError }}</div>

        <template v-if="loading && !pharmacies.length"><div v-for="i in 4" :key="i" class="skeleton h-28 rounded-2xl" /></template>

        <article
          v-for="p in pharmacies"
          :key="p.id"
          :data-id="p.id"
          class="card card-hover cursor-pointer p-4 transition"
          :class="p.id === selectedId ? 'ring-2 ring-gold-400' : ''"
          @click="select(p)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="font-bold text-slate-900">{{ p.name }}</h3>
              <p class="text-xs font-bold" :class="isHospital(p) ? 'text-rose-600' : 'text-brand-700'">{{ isHospital(p) ? 'Hospital / clinic' : 'Pharmacy' }}</p>
            </div>
            <span class="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">{{ distanceLabel(p.distance_km) }}</span>
          </div>
          <p class="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
            <MapPinIcon class="mt-0.5 size-4 shrink-0 text-brand-500" />
            <span>{{ [p.address_line, p.sub_city, p.city].filter(Boolean).join(', ') }}</span>
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <template v-if="isHospital(p)">
              <span v-if="p.services?.includes('emergency')" class="chip bg-rose-50 text-rose-700 ring-rose-600/15"><HeartIcon class="size-3.5" /> Emergency 24/7</span>
              <span v-if="p.services?.includes('laboratory')" class="chip bg-violet-50 text-violet-700 ring-violet-600/15"><BeakerIcon class="size-3.5" /> Laboratory</span>
              <span v-if="p.services?.includes('pharmacy')" class="chip bg-brand-50 text-brand-800 ring-brand-100">+ Pharmacy</span>
              <span v-if="p.services?.includes('insurance')" class="chip bg-sky-50 text-sky-700 ring-sky-600/15"><ShieldCheckIcon class="size-3.5" /> Insurance / CBHI</span>
              <span
                v-for="sp in (p.specialties ?? []).slice(0, 4)"
                :key="sp.id"
                class="chip ring-1"
                :class="sp.slug === specialty ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-700 ring-slate-200'"
              >{{ sp.name }}</span>
              <span v-if="(p.specialties ?? []).length > 4" class="chip bg-slate-50 text-slate-500 ring-slate-200" :title="p.specialties.slice(4).map((x) => x.name).join(', ')">+{{ p.specialties.length - 4 }} more</span>
            </template>
            <template v-else>
              <span v-if="p.is_24_hours" class="chip bg-gold-100 text-brand-950 ring-gold-300"><ClockIcon class="size-3.5" /> 24/7</span>
              <span v-if="p.delivery_available" class="chip bg-brand-50 text-brand-800 ring-brand-100"><TruckIcon class="size-3.5" /> Delivery</span>
            </template>
          </div>
          <p v-if="isHospital(p) && p.opening_hours" class="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500"><ClockIcon class="size-3.5" /> {{ p.opening_hours }}</p>
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm font-semibold">
            <RouterLink v-if="!isHospital(p)" :to="{ name: 'pharmacy', params: { slug: p.slug } }" class="text-brand-700 hover:underline" @click.stop>View medicines</RouterLink>
            <a :href="directionsUrl(p, origin)" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sky-700 hover:underline" @click.stop>
              Directions <ArrowTopRightOnSquareIcon class="size-3.5" />
            </a>
            <a v-if="p.phone" :href="`tel:${p.phone}`" class="inline-flex items-center gap-1 text-slate-600 hover:underline" @click.stop>
              <PhoneIcon class="size-3.5" /> {{ phone(p.phone) }}
            </a>
          </div>
        </article>

        <div v-if="!loading && !loadError && origin && !pharmacies.length" class="card py-10">
          <EmptyState :title="type === 'hospital' ? 'No hospitals or clinics nearby' : 'No pharmacies nearby'" :text="radius < 25 ? 'Try a bigger search radius or clear the filters.' : 'No registered facility has shared its location in this area yet.'">
            <button v-if="radius < 25" class="btn btn-primary" @click="radius = RADII[RADII.indexOf(radius) + 1]">Search within {{ RADII[RADII.indexOf(radius) + 1] }} km</button>
          </EmptyState>
        </div>
      </div>
    </section>
  </div>
</template>
