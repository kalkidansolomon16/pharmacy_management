import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const read = (key, fallback) => {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

let toastId = 0

export const useUiStore = defineStore('ui', () => {
  const toasts = ref([])
  const confirmState = ref(null)
  const sidebarOpen = ref(false)
  /** 'gregorian' | 'ethiopian' - how dates are displayed across the app */
  const calendar = ref(read('medlink.calendar', 'gregorian'))

  watch(calendar, (v) => {
    try { localStorage.setItem('medlink.calendar', v) } catch { /* ignore */ }
  })

  function toast(message, { type = 'success', title = null, timeout = 4500 } = {}) {
    const id = ++toastId
    toasts.value.push({ id, message, type, title })
    if (timeout) setTimeout(() => dismiss(id), timeout)
    return id
  }

  const success = (message, title) => toast(message, { type: 'success', title })
  const error = (message, title) => toast(message, { type: 'error', title, timeout: 7000 })
  const info = (message, title) => toast(message, { type: 'info', title })

  function dismiss(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  /**
   * Promise-based confirmation dialog.
   * await ui.confirm({ title, message, confirmText, danger, input: { label, required } }) -> false | true | string
   */
  function confirm(options) {
    return new Promise((resolve) => {
      confirmState.value = { confirmText: 'Confirm', danger: false, ...options, resolve }
    })
  }

  function resolveConfirm(value) {
    confirmState.value?.resolve(value)
    confirmState.value = null
  }

  return { toasts, toast, success, error, info, dismiss, confirmState, confirm, resolveConfirm, sidebarOpen, calendar }
})
