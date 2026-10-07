<script setup>
import { computed } from 'vue'

const props = defineProps({
  quantity: { type: Number, default: 0 },
  reorder: { type: Number, default: 0 },
})
// Scale: 3x the reorder level counts as "full"
const pct = computed(() => Math.min(100, (props.quantity / Math.max(1, props.reorder * 3)) * 100))
const color = computed(() => (props.quantity === 0 ? 'bg-rose-500' : props.quantity <= props.reorder ? 'bg-amber-500' : 'bg-brand-500'))
</script>

<template>
  <div class="w-28">
    <div class="flex items-baseline justify-between text-sm">
      <b :class="quantity === 0 ? 'text-rose-600' : quantity <= reorder ? 'text-amber-600' : 'text-slate-900'">{{ quantity.toLocaleString() }}</b>
      <span class="text-[0.68rem] text-slate-400">/ {{ reorder }}</span>
    </div>
    <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full transition-all" :class="color" :style="{ width: pct + '%' }" /></div>
  </div>
</template>
