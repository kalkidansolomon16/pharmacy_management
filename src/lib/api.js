import axios from 'axios'

const TOKEN_KEY = 'medlink.token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Listeners notified when the API says our session is gone (401) or our organization is blocked. */
const sessionListeners = new Set()
export const onSessionProblem = (fn) => sessionListeners.add(fn)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const code = error.response?.data?.code
    if (status === 401 && tokenStorage.get()) sessionListeners.forEach((fn) => fn('expired'))
    if (status === 403 && code?.startsWith('tenant_')) sessionListeners.forEach((fn) => fn(code))
    if (status === 402 && code === 'subscription_expired') sessionListeners.forEach((fn) => fn(code))
    return Promise.reject(normalizeError(error))
  },
)

/**
 * Every API error has the shape { message, errors? }. Turn it into something views can render directly.
 */
export function normalizeError(error) {
  const data = error.response?.data
  const normalized = new Error(
    data?.message ||
      (error.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check your connection and that the API is running.' : 'Something went wrong. Please try again.'),
  )
  normalized.status = error.response?.status ?? 0
  normalized.code = data?.code
  normalized.errors = Object.fromEntries(Object.entries(data?.errors ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
  normalized.raw = error
  return normalized
}

/** Download a file endpoint (CSV/PDF) through the authenticated client. */
export async function download(url, params = {}) {
  const response = await api.get(url, { params, responseType: 'blob' })
  const disposition = response.headers['content-disposition'] || ''
  const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1] || 'report'
  const href = URL.createObjectURL(response.data)
  const a = Object.assign(document.createElement('a'), { href, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

export default api
