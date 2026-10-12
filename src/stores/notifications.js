import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/lib/api'

const POLL_MS = 30000

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref([])
  const unread = ref(0)
  const loading = ref(false)
  let timer = null

  async function fetchLatest() {
    loading.value = true
    try {
      const { data } = await api.get('/notifications', { params: { per_page: 8 } })
      items.value = data.data
      unread.value = data.meta.unread_count
    } finally {
      loading.value = false
    }
  }

  async function refreshCount() {
    try {
      const { data } = await api.get('/notifications/unread-count')
      if (data.data.unread_count !== unread.value) await fetchLatest()
    } catch {
      /* offline / signed out */
    }
  }

  async function markRead(notification) {
    if (notification.read_at) return
    notification.read_at = new Date().toISOString()
    unread.value = Math.max(0, unread.value - 1)
    await api.post(`/notifications/${notification.id}/read`)
  }

  async function markAllRead() {
    await api.post('/notifications/read-all')
    items.value.forEach((n) => (n.read_at ||= new Date().toISOString()))
    unread.value = 0
  }

  function start() {
    stop()
    fetchLatest().catch(() => {})
    timer = setInterval(refreshCount, POLL_MS)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  return { items, unread, loading, fetchLatest, markRead, markAllRead, start, stop }
})
