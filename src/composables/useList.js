import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/lib/api'

/**
 * Paginated, filterable list bound to a Laravel resource collection endpoint.
 * Filters are mirrored into the URL query so lists are shareable and survive refresh.
 *
 * const { rows, meta, loading, filters, page, reload } = useList('/inventory', { search: '', filter: '' })
 */
export function useList(url, defaults = {}, { perPage = 15, syncQuery = true, debounce = 300, immediate = true } = {}) {
  const route = useRoute()
  const router = useRouter()

  const initial = { ...defaults }
  if (syncQuery) {
    for (const key of Object.keys(defaults)) {
      if (route.query[key] !== undefined) initial[key] = route.query[key]
    }
  }

  const filters = reactive(initial)
  const page = ref(Number(syncQuery ? route.query.page : 1) || 1)
  const rows = ref([])
  const meta = ref({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 })
  const extra = ref({})
  const loading = ref(false)
  const error = ref(null)
  let timer = null
  let requestId = 0

  async function load() {
    const id = ++requestId
    loading.value = true
    error.value = null
    const params = { page: page.value, per_page: perPage }
    for (const [k, v] of Object.entries(filters)) if (v !== '' && v !== null && v !== undefined && v !== false) params[k] = v

    try {
      const { data } = await api.get(typeof url === 'function' ? url() : url, { params })
      if (id !== requestId) return // a newer request superseded this one
      rows.value = data.data
      meta.value = data.meta ?? { current_page: 1, last_page: 1, total: data.data.length }
      extra.value = data.meta ?? {}
      if (syncQuery) {
        const query = { ...route.query, ...Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'per_page')) }
        for (const k of Object.keys(defaults)) if (params[k] === undefined) delete query[k]
        if (page.value === 1) delete query.page
        router.replace({ query }).catch(() => {})
      }
    } catch (e) {
      if (id === requestId) error.value = e
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  watch(filters, () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      page.value = 1
      load()
    }, debounce)
  }, { deep: true })

  watch(page, load)

  function reset() {
    Object.assign(filters, defaults)
  }

  if (immediate) load()

  return { rows, meta, extra, loading, error, filters, page, reload: load, reset }
}
