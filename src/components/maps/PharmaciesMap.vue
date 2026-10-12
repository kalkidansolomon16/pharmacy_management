<script setup>
/**
 * Pharmacies on an interactive map with the visitor's position.
 * Google Maps when VITE_GOOGLE_MAPS_API_KEY is set; otherwise the free OpenStreetMap (Leaflet) map - no key, no billing.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MAP_ID, directionsUrl, distanceLabel, hasGoogleMapsKey, loadGoogleMaps } from '@/lib/googleMaps'

const props = defineProps({
  pharmacies: { type: Array, default: () => [] }, // PublicPharmacyResource (+ optional distance_km, label)
  origin: { type: Object, default: null }, // { lat, lng }
  selectedId: { type: [Number, String], default: null },
  radiusKm: { type: Number, default: null }, // draws the search circle around the origin
  pickable: { type: Boolean, default: false }, // clicking the map / dragging "you" emits pick({ lat, lng })
  fitOnChange: { type: Boolean, default: true },
})
const emit = defineEmits(['select', 'pick'])

const mapEl = ref(null)
const engine = ref(hasGoogleMapsKey ? 'google' : 'osm')
let impl = null // { draw(), highlight(), destroy() }

const mapped = () => props.pharmacies.filter((p) => p.latitude != null && p.longitude != null && p.latitude !== '')
const pos = (p) => ({ lat: Number(p.latitude), lng: Number(p.longitude) })

/** Popup content, built with DOM nodes (no HTML injection from pharmacy data). */
function bubble(p) {
  const node = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls ?? '', textContent: text ?? '' })
  const root = node('div', 'max-w-60 space-y-1 text-sm text-slate-600')
  root.append(node('p', 'font-bold text-slate-900', p.name))
  if (p.distance_km != null) root.append(node('p', 'font-semibold text-brand-700', `${distanceLabel(p.distance_km)} away`))
  if (p.label) root.append(node('p', 'font-semibold text-slate-800', p.label))
  const place = [p.address_line, p.sub_city, p.city].filter(Boolean).join(', ')
  if (place) root.append(node('p', '', place))
  const go = node('a', 'font-semibold text-sky-700 hover:underline', 'Directions ↗')
  go.href = directionsUrl(p, props.origin)
  go.target = '_blank'
  go.rel = 'noopener'
  root.append(go)
  return root
}

/* ---------------- OpenStreetMap (free) ---------------- */
async function initOsm() {
  const { createMap, pharmacyIcon, youIcon, L, ADDIS_ABABA } = await import('@/lib/osmMap')
  if (!mapEl.value) return
  const map = createMap(mapEl.value, { center: props.origin ?? ADDIS_ABABA })
  const markers = new Map()
  let you = null
  let circle = null

  if (props.pickable) map.on('click', (e) => emit('pick', { lat: e.latlng.lat, lng: e.latlng.lng }))

  impl = {
    draw() {
      for (const m of markers.values()) m.remove()
      markers.clear()
      const bounds = L.latLngBounds([])
      for (const p of mapped()) {
        const marker = L.marker([pos(p).lat, pos(p).lng], { icon: pharmacyIcon(p.id === props.selectedId, p.type), title: p.name })
          .addTo(map)
          .bindPopup(() => bubble(p))
          .on('click', () => emit('select', p))
        markers.set(p.id, marker)
        bounds.extend(marker.getLatLng())
      }
      if (props.origin) {
        const at = [props.origin.lat, props.origin.lng]
        if (!you) {
          you = L.marker(at, { icon: youIcon(), draggable: props.pickable, zIndexOffset: 1000, title: props.pickable ? 'You are here - drag to move' : 'You are here' }).addTo(map)
          you.on('dragend', () => emit('pick', { lat: you.getLatLng().lat, lng: you.getLatLng().lng }))
        } else you.setLatLng(at)
        bounds.extend(at)
        if (props.radiusKm) {
          circle ??= L.circle(at, { radius: 0, color: '#059669', weight: 1, opacity: 0.6, fillColor: '#10b981', fillOpacity: 0.06, interactive: false }).addTo(map)
          circle.setLatLng(at).setRadius(props.radiusKm * 1000)
        }
      }
      if (!props.fitOnChange) return
      if (circle && props.origin) map.fitBounds(circle.getBounds(), { padding: [16, 16] })
      else if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    },
    highlight() {
      const types = Object.fromEntries(mapped().map((p) => [p.id, p.type]))
      for (const [id, marker] of markers) {
        marker.setIcon(pharmacyIcon(id === props.selectedId, types[id]))
        marker.setZIndexOffset(id === props.selectedId ? 900 : 0)
      }
      const marker = markers.get(props.selectedId)
      if (marker) {
        map.panTo(marker.getLatLng())
        marker.openPopup()
      }
    },
    destroy: () => map.remove(),
  }
  impl.draw()
  // The container may have been hidden/resized while loading
  setTimeout(() => map.invalidateSize(), 50)
}

/* ---------------- Google Maps (when a key is configured) ---------------- */
async function initGoogle() {
  const maps = await loadGoogleMaps()
  const [{ Map, InfoWindow, Circle }, { AdvancedMarkerElement }] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')])
  if (!mapEl.value) return
  const map = new Map(mapEl.value, {
    center: props.origin ?? { lat: 9.0108, lng: 38.7613 }, zoom: 13, mapId: MAP_ID,
    clickableIcons: false, streetViewControl: false, mapTypeControl: false, gestureHandling: 'cooperative',
  })
  const info = new InfoWindow()
  const markers = new Map()
  let you = null
  let circle = null
  const dot = (cls, text = '') => Object.assign(document.createElement('div'), { className: cls, textContent: text })
  const pinClass = (on, type) => `grid size-8 cursor-pointer place-items-center rounded-full border-2 border-white text-lg font-black leading-none text-white shadow-lg transition-transform ${on ? 'scale-125 bg-gold-500' : type === 'hospital' ? 'bg-rose-600' : 'bg-brand-700'}`
  if (props.pickable) map.addListener('click', (e) => emit('pick', { lat: e.latLng.lat(), lng: e.latLng.lng() }))

  impl = {
    draw() {
      for (const m of markers.values()) m.map = null
      markers.clear()
      const bounds = new maps.LatLngBounds()
      for (const p of mapped()) {
        const marker = new AdvancedMarkerElement({ map, position: pos(p), content: dot(pinClass(p.id === props.selectedId, p.type), p.type === 'hospital' ? 'H' : '+'), title: p.name })
        marker.addEventListener('gmp-click', () => emit('select', p))
        markers.set(p.id, marker)
        bounds.extend(pos(p))
      }
      if (props.origin) {
        you ??= new AdvancedMarkerElement({ map, content: dot('size-4 rounded-full border-[3px] border-white bg-sky-600 shadow-lg ring-4 ring-sky-400/40'), gmpDraggable: props.pickable, zIndex: 1000, title: 'You are here' })
        you.position = { lat: props.origin.lat, lng: props.origin.lng }
        if (props.pickable && !you.dragBound) {
          you.dragBound = true
          you.addListener('dragend', () => {
            const p = you.position
            emit('pick', { lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng })
          })
        }
        bounds.extend({ lat: props.origin.lat, lng: props.origin.lng })
        if (props.radiusKm) {
          circle ??= new Circle({ map, clickable: false, strokeColor: '#059669', strokeOpacity: 0.6, strokeWeight: 1, fillColor: '#10b981', fillOpacity: 0.06 })
          circle.setCenter({ lat: props.origin.lat, lng: props.origin.lng })
          circle.setRadius(props.radiusKm * 1000)
        }
      }
      if (!props.fitOnChange) return
      if (circle && props.origin) map.fitBounds(circle.getBounds(), 16)
      else if (!bounds.isEmpty()) map.fitBounds(bounds, 48)
    },
    highlight() {
      const types = Object.fromEntries(mapped().map((p) => [p.id, p.type]))
      for (const [id, marker] of markers) {
        marker.content.className = pinClass(id === props.selectedId, types[id])
        marker.zIndex = id === props.selectedId ? 999 : null
      }
      const p = mapped().find((x) => x.id === props.selectedId)
      if (p && markers.has(p.id)) {
        info.setContent(bubble(p))
        info.open({ map, anchor: markers.get(p.id) })
        map.panTo(pos(p))
      }
    },
    destroy() {
      for (const m of markers.values()) m.map = null
      if (you) you.map = null
      circle?.setMap(null)
    },
  }
  impl.draw()
}

watch(() => [props.pharmacies, props.origin, props.radiusKm], () => impl?.draw(), { deep: true })
watch(() => props.selectedId, () => impl?.highlight())

// An invalid / unauthorised Google key: fall back to the free map
const onAuthFailure = () => switchToOsm()
async function switchToOsm() {
  impl?.destroy()
  impl = null
  engine.value = 'osm'
  if (mapEl.value) mapEl.value.replaceChildren()
  await initOsm()
}

onMounted(async () => {
  if (engine.value === 'google') {
    window.addEventListener('google-maps-auth-failure', onAuthFailure)
    try {
      await initGoogle()
      return
    } catch {
      return switchToOsm()
    }
  }
  await initOsm()
})
onBeforeUnmount(() => {
  window.removeEventListener('google-maps-auth-failure', onAuthFailure)
  impl?.destroy()
})
</script>

<template>
  <div ref="mapEl" class="relative z-0 size-full bg-slate-100" />
</template>
