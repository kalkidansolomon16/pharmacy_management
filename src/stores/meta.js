import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/lib/api'

/**
 * Ethiopia reference data (regions, cities, payment methods...) and catalogue categories, loaded once.
 */
export const useMetaStore = defineStore('meta', () => {
  const meta = ref(null)
  const categories = ref([])
  let pending = null

  async function load() {
    if (meta.value) return meta.value
    pending ??= Promise.all([api.get('/public/meta'), api.get('/public/categories')]).then(([m, c]) => {
      meta.value = m.data.data
      categories.value = c.data.data
      return meta.value
    }).finally(() => (pending = null))
    return pending
  }

  const regions = computed(() => meta.value?.regions ?? [])
  const allCities = computed(() => regions.value.flatMap((r) => r.cities))
  const subCities = computed(() => meta.value?.addis_sub_cities ?? [])
  const paymentMethods = computed(() => meta.value?.payment_methods ?? [])
  const dosageForms = computed(() => meta.value?.dosage_forms ?? [])
  const suppliers = computed(() => meta.value?.suppliers ?? [])
  const bloodGroups = computed(() => meta.value?.blood_groups ?? [])
  const citiesWithPharmacies = computed(() => meta.value?.cities_with_pharmacies ?? [])

  const citiesFor = (regionName) => regions.value.find((r) => r.name === regionName)?.cities ?? []
  const paymentLabel = (value) => paymentMethods.value.find((p) => p.value === value)?.label ?? value

  return { meta, categories, load, regions, allCities, subCities, paymentMethods, dosageForms, suppliers, bloodGroups, citiesWithPharmacies, citiesFor, paymentLabel }
})
