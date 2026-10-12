<script setup>
/**
 * Lets a pharmacy / hospital put itself on the map: click the map or drag the pin, or use the device's location.
 * Google Maps when a key is configured, otherwise the free OpenStreetMap map (no key, no billing).
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MapPinIcon } from '@heroicons/vue/24/outline'
import { MAP_ID, hasGoogleMapsKey, loadGoogleMaps } from '@/lib/googleMaps'

const lat = defineModel('lat', { type: [Number, String], default: '' })
const lng = defineModel('lng', { type: [Number, String], default: '' })
defineProps({ label: { type: String, default: '' } })

const mapEl = ref(null)
const locating = ref(false)
const locateError = ref('')
let api = null // { move(point, zoom?), destroy() }

const has = () => lat.value !== '' && lat.value !== null && lng.value !== '' && lng.value !== null && !Number.isNaN(Number(lat.value))
const point = () => ({ lat: Number(lat.value), lng: Number(lng.value) })

function set(position) {
  lat.value = Number(position.lat).toFixed(6)
  lng.value = Number(position.lng).toFixed(6)
}

function useDevice() {
  if (!navigator.geolocation) return (locateError.value = 'This browser cannot share its location.')
  locating.value = true
  locateError.value = ''
  navigator.geolocation.getCurrentPosition(
    (p) => {
      locating.value = false
      set({ lat: p.coords.latitude, lng: p.coords.longitude })
      api?.move(point(), 17)
    },
    () => {
      locating.value = false
      locateError.value = 'Location access was blocked or unavailable.'
    },
    { enableHighAccuracy: true, timeout: 12000 },
  )
}

// Typed coordinates move the pin too
watch([lat, lng], () => has() && api?.move(point()))

async function initOsm() {
  const { createMap, pinIcon, L, ADDIS_ABABA } = await import('@/lib/osmMap')
  if (!mapEl.value) return
  const map = createMap(mapEl.value, { center: has() ? point() : ADDIS_ABABA, zoom: has() ? 17 : 12 })
  let pin = null
  const place = (at) => {
    if (!pin) {
      pin = L.marker([at.lat, at.lng], { icon: pinIcon(), draggable: true, title: 'Drag to your entrance' }).addTo(map)
      pin.on('dragend', () => set(pin.getLatLng()))
    } else pin.setLatLng([at.lat, at.lng])
  }
  if (has()) place(point())
  map.on('click', (e) => {
    set(e.latlng)
    place(e.latlng)
  })
  api = {
    move(at, zoom) {
      place(at)
      zoom ? map.setView([at.lat, at.lng], zoom) : map.panTo([at.lat, at.lng])
    },
    destroy: () => map.remove(),
  }
  setTimeout(() => map.invalidateSize(), 50)
}

async function initGoogle() {
  const maps = await loadGoogleMaps()
  const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')])
  if (!mapEl.value) return
  const map = new Map(mapEl.value, {
    center: has() ? point() : { lat: 9.0108, lng: 38.7613 }, zoom: has() ? 17 : 12, mapId: MAP_ID,
    streetViewControl: false, mapTypeControl: true, clickableIcons: false,
  })
  const pin = new AdvancedMarkerElement({ map, position: has() ? point() : null, gmpDraggable: true, title: 'Drag to your entrance' })
  pin.addListener('dragend', () => {
    const p = pin.position
    set({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng })
  })
  map.addListener('click', (e) => {
    set({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    pin.position = point()
  })
  api = {
    move(at, zoom) {
      pin.position = at
      map.panTo(at)
      if (zoom) map.setZoom(zoom)
    },
    destroy: () => (pin.map = null),
  }
}

onMounted(async () => {
  if (hasGoogleMapsKey) {
    try {
      return await initGoogle()
    } catch {
      mapEl.value?.replaceChildren()
    }
  }
  await initOsm()
})
onBeforeUnmount(() => api?.destroy())
</script>

<template>
  <div class="space-y-2">
    <div class="h-64 overflow-hidden rounded-2xl border border-slate-200">
      <div ref="mapEl" class="relative z-0 size-full bg-slate-100" />
    </div>
    <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <button type="button" class="btn btn-secondary btn-sm" :disabled="locating" @click="useDevice"><MapPinIcon class="size-4" /> {{ locating ? 'Locating…' : 'Use this device\'s location' }}</button>
      <span>Or click the map / drag the pin to your entrance.</span>
      <span v-if="locateError" class="font-semibold text-rose-600">{{ locateError }}</span>
    </div>
  </div>
</template>
