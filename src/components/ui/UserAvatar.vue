<script setup>
import { computed } from 'vue'
import { initials } from '@/lib/format'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: String, default: 'md' },
})

const palette = [
  'from-brand-400 to-brand-700', 'from-gold-300 to-gold-600', 'from-sky-400 to-sky-700',
  'from-violet-400 to-violet-700', 'from-rose-400 to-rose-700', 'from-teal-400 to-teal-700',
]
const color = computed(() => palette[[...(props.name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length])
const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' }
</script>

<template>
  <span class="inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white" :class="[color, sizes[size]]">
    {{ initials(name) }}
  </span>
</template>
