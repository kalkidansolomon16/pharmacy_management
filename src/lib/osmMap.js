/**
 * Free interactive maps: Leaflet + OpenStreetMap tiles. No API key, no billing.
 * Used whenever VITE_GOOGLE_MAPS_API_KEY is not set (the Google loader in googleMaps.js is used when it is).
 * OpenStreetMap's tile policy asks for attribution (kept below) and light, interactive use - fine for MedLink.
 */
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export const ADDIS_ABABA = { lat: 9.0108, lng: 38.7613 }

export function createMap(el, { center = ADDIS_ABABA, zoom = 13, scrollWheelZoom = false } = {}) {
  const map = L.map(el, { center: [center.lat, center.lng], zoom, scrollWheelZoom, zoomControl: true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(map)
  // Wheel zoom only after the user clicks the map, so the page still scrolls normally
  map.on('click', () => map.scrollWheelZoom.enable())
  map.on('mouseout', () => map.scrollWheelZoom.disable())
  // Keep Leaflet's idea of the map size current: maps created while hidden (tabs, toggled panels,
  // a background browser tab) otherwise draw grey tiles and turn taps into the wrong coordinates.
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(el)
    map.on('unload', () => observer.disconnect())
  }
  return map
}

/** MedLink-green "+" pin; gold when selected. */
export const pharmacyIcon = (active = false, type = 'pharmacy') =>
  L.divIcon({
    className: '',
    html: `<div class="grid size-8 place-items-center rounded-full border-2 border-white text-lg font-black leading-none text-white shadow-lg transition-transform ${active ? 'scale-125 bg-gold-500' : type === 'hospital' ? 'bg-rose-600' : 'bg-brand-700'}">${type === 'hospital' ? 'H' : '+'}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })

/** Pulsing blue "you are here" dot. */
export const youIcon = () =>
  L.divIcon({
    className: '',
    html: '<div class="relative grid size-6 place-items-center"><span class="absolute inset-0 animate-ping rounded-full bg-sky-400/50"></span><span class="relative size-4 rounded-full border-[3px] border-white bg-sky-600 shadow-lg"></span></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

/** Draggable location pin for organization setup. */
export const pinIcon = () =>
  L.divIcon({
    className: '',
    html: '<svg viewBox="0 0 24 24" class="size-10 drop-shadow-lg"><path fill="#047857" stroke="white" stroke-width="1.5" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.6" fill="white"/></svg>',
    iconSize: [40, 40],
    iconAnchor: [20, 38],
  })

export { L }
