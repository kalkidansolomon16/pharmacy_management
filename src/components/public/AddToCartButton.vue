<script setup>
import { computed } from 'vue'
import { CheckIcon, PlusIcon } from '@heroicons/vue/20/solid'
import { useCartStore } from '@/stores/cart'
import { useUiStore } from '@/stores/ui'

const props = defineProps({
  listingId: { type: Number, required: true },
  price: { type: Number, required: true },
  available: { type: Number, default: 0 },
  medicine: { type: Object, required: true },
  pharmacy: { type: Object, required: true },
  size: { type: String, default: 'sm' },
})

const cart = useCartStore()
const ui = useUiStore()
const inCart = computed(() => cart.has(props.listingId))
const disabled = computed(() => !props.available || props.medicine.is_controlled)

function add() {
  cart.add({ ...props })
  ui.success(`${props.medicine.display_name} added from ${props.pharmacy.name}.`, 'Added to cart')
}
</script>

<template>
  <button
    class="btn"
    :class="[size === 'sm' ? 'btn-sm' : '', inCart ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'btn-primary']"
    :disabled="disabled"
    :title="medicine.is_controlled ? 'Controlled medicine: available in person only' : ''"
    @click.prevent="add"
  >
    <component :is="inCart ? CheckIcon : PlusIcon" class="size-4" />
    {{ medicine.is_controlled ? 'In person only' : inCart ? 'In cart' : 'Add' }}
  </button>
</template>
