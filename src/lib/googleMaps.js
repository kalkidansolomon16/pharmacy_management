/**
 * Loads the Google Maps JavaScript API once, on demand.
 *
 * Needs VITE_GOOGLE_MAPS_API_KEY (a browser key restricted to this site's
 * domain, with the "Maps JavaScript API" enabled). VITE_GOOGLE_MAPS_MAP_ID is
 * optional; Google's DEMO_MAP_ID works for development.
 */
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'
export const hasGoogleMapsKey = Boolean(API_KEY)

let loading = null

export function loadGoogleMaps() {
  if (!API_KEY) return Promise.reject(new Error('Google Maps API key is not configured.'))
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps)

  loading ??= new Promise((resolve, reject) => {
    const callback = '__medlinkGoogleMapsReady'
    window[callback] = () => {
      delete window[callback]
      resolve(window.google.maps)
    }
    // Google calls this global when the key is invalid or not allowed on this domain
    window.gm_authFailure = () => window.dispatchEvent(new Event('google-maps-auth-failure'))

    const script = document.createElement('script')
    const params = new URLSearchParams({ key: API_KEY, v: 'weekly', loading: 'async', libraries: 'marker', callback })
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Google Maps could not be loaded. Check your internet connection.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** Google Maps turn-by-turn directions, opened in the app or a new tab. */
export const directionsUrl = (to, from) =>
  `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: '1',
    destination: `${to.latitude},${to.longitude}`,
    ...(from ? { origin: `${from.lat},${from.lng}` } : {}),
  })}`

/** A single place on Google Maps. */
export const placeUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

/** "650 m" / "2.4 km" */
export const distanceLabel = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`)
