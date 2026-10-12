import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/lib/api'

const KEY = 'medlink.offline.sales'

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

/** RFC 4122 v4 id: the server treats a repeated client_uuid as the same sale (safe retries). */
export const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })

/**
 * Offline-first counter sales: when the network or power drops, sales are kept on this device and
 * synced automatically when the connection returns. Ethiopian pharmacies keep selling during outages.
 */
export const useOfflineStore = defineStore('offline', () => {
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  const queue = ref(read())
  const syncing = ref(false)
  const lastError = ref(null)

  const pending = computed(() => queue.value.length)

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(queue.value)) } catch { /* storage full / private mode */ }
  }

  /** Keep a sale for later. Payload must already carry its client_uuid. */
  function enqueueSale(payload, summary = {}) {
    queue.value.push({ payload, summary, queued_at: new Date().toISOString(), attempts: 0 })
    persist()
  }

  async function flush() {
    if (syncing.value || !queue.value.length || !online.value) return { synced: 0 }
    syncing.value = true
    lastError.value = null
    let synced = 0
    try {
      for (const entry of [...queue.value]) {
        try {
          await api.post('/pos/sales', entry.payload)
          queue.value = queue.value.filter((e) => e.payload.client_uuid !== entry.payload.client_uuid)
          synced++
        } catch (error) {
          if (error.status === 0) break // still offline - try again later
          // The server refused it (e.g. stock ran out meanwhile): keep it visible for the pharmacist
          entry.attempts++
          entry.error = error.message
          lastError.value = error.message
        }
        persist()
      }
    } finally {
      syncing.value = false
    }
    return { synced }
  }

  function discard(clientUuid) {
    queue.value = queue.value.filter((e) => e.payload.client_uuid !== clientUuid)
    persist()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { online.value = true; flush() })
    window.addEventListener('offline', () => { online.value = false })
  }

  return { online, queue, pending, syncing, lastError, enqueueSale, flush, discard }
})
