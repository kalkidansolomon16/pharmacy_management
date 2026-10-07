import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const KEY = 'medlink.cart'

/**
 * Shopping cart. An order goes to exactly one pharmacy, so the cart is grouped per pharmacy
 * and the customer checks out one pharmacy at a time.
 */
export const useCartStore = defineStore('cart', () => {
  const lines = ref(load())

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) ?? [] } catch { return [] }
  }

  watch(lines, (v) => {
    try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* ignore */ }
  }, { deep: true })

  const count = computed(() => lines.value.reduce((sum, l) => sum + l.quantity, 0))
  const itemCount = computed(() => lines.value.length)

  const byPharmacy = computed(() => {
    const groups = new Map()
    for (const line of lines.value) {
      if (!groups.has(line.pharmacy.id)) groups.set(line.pharmacy.id, { pharmacy: line.pharmacy, lines: [], total: 0, needsPrescription: false })
      const g = groups.get(line.pharmacy.id)
      g.lines.push(line)
      g.total += line.price * line.quantity
      g.needsPrescription ||= line.medicine.prescription_required || line.medicine.is_controlled
    }
    return [...groups.values()]
  })

  /**
   * @param {{listingId:number, price:number, available:number, medicine:object, pharmacy:object}} offer
   */
  function add(offer, quantity = 1) {
    const existing = lines.value.find((l) => l.listingId === offer.listingId)
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, offer.available || existing.quantity + quantity)
      return existing
    }
    const line = {
      listingId: offer.listingId,
      price: Number(offer.price),
      available: offer.available,
      quantity: Math.min(quantity, offer.available || quantity),
      medicine: {
        id: offer.medicine.id,
        display_name: offer.medicine.display_name,
        generic_name: offer.medicine.generic_name,
        brand_name: offer.medicine.brand_name,
        dosage_form: offer.medicine.dosage_form,
        unit: offer.medicine.unit,
        prescription_required: offer.medicine.prescription_required,
        is_controlled: offer.medicine.is_controlled,
      },
      pharmacy: {
        id: offer.pharmacy.id,
        name: offer.pharmacy.name,
        slug: offer.pharmacy.slug,
        city: offer.pharmacy.city,
        sub_city: offer.pharmacy.sub_city,
        delivery_available: offer.pharmacy.delivery_available,
      },
    }
    lines.value.push(line)
    return line
  }

  function setQuantity(listingId, quantity) {
    const line = lines.value.find((l) => l.listingId === listingId)
    if (!line) return
    line.quantity = Math.max(1, Math.min(Number(quantity) || 1, line.available || 9999))
  }

  function remove(listingId) {
    lines.value = lines.value.filter((l) => l.listingId !== listingId)
  }

  function clearPharmacy(pharmacyId) {
    lines.value = lines.value.filter((l) => l.pharmacy.id !== pharmacyId)
  }

  const has = (listingId) => lines.value.some((l) => l.listingId === listingId)

  return { lines, count, itemCount, byPharmacy, add, setQuantity, remove, clearPharmacy, has }
})
