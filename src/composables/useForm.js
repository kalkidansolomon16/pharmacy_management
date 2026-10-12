import { reactive, ref } from 'vue'
import { useUiStore } from '@/stores/ui'

/**
 * Form state + server-side validation errors.
 *
 * const form = useForm({ name: '' })
 * await form.submit(() => api.post('/x', form.data), { success: 'Saved' })
 */
export function useForm(initial = {}) {
  const ui = useUiStore()
  const data = reactive(structuredClone(initial))
  const errors = ref({})
  const processing = ref(false)

  async function submit(request, { success, onSuccess, toastErrors = true } = {}) {
    processing.value = true
    errors.value = {}
    try {
      const response = await request()
      const message = response?.data?.message ?? success
      if (message) ui.success(message)
      await onSuccess?.(response?.data)
      return response?.data
    } catch (error) {
      errors.value = error.errors ?? {}
      if (toastErrors) ui.error(error.message)
      throw error
    } finally {
      processing.value = false
    }
  }

  function reset(values = initial) {
    Object.keys(data).forEach((k) => delete data[k])
    Object.assign(data, structuredClone(values))
    errors.value = {}
  }

  /** errors for nested keys like "items.0.quantity" or "organization.name" */
  const error = (key) => errors.value[key]

  return { data, errors, processing, submit, reset, error }
}
