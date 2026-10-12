import { computed, ref } from 'vue'

const KEY = 'medlink.location'

const read = () => {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') } catch { return null }
}

// Shared across pages: once a patient shares their location, search, prescription check and the map reuse it
const position = ref(read()) // { lat, lng, accuracy, at }
const status = ref(position.value ? 'ready' : 'idle') // idle | locating | ready | denied | unavailable
const error = ref('')

/**
 * The visitor's location (browser geolocation; needs HTTPS in production).
 * Kept for this browser session only - it is never sent anywhere except as search parameters.
 */
export function useUserLocation() {
  function locate({ force = false } = {}) {
    if (position.value && !force) return Promise.resolve(position.value)
    if (!navigator.geolocation) {
      status.value = 'unavailable'
      error.value = 'Your browser cannot share its location.'
      return Promise.reject(new Error(error.value))
    }
    status.value = 'locating'
    error.value = ''
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          position.value = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy), at: Date.now() }
          try { sessionStorage.setItem(KEY, JSON.stringify(position.value)) } catch { /* private mode */ }
          status.value = 'ready'
          resolve(position.value)
        },
        (err) => {
          status.value = err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'
          error.value = err.code === err.PERMISSION_DENIED
            ? 'Location access was blocked. Allow it in your browser settings to see the nearest pharmacies.'
            : 'We could not find your location. Check that location (GPS) is turned on.'
          reject(new Error(error.value))
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 },
      )
    })
  }

  function forget() {
    position.value = null
    status.value = 'idle'
    try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
  }

  return { position, status, error, locate, forget, locating: computed(() => status.value === 'locating') }
}
