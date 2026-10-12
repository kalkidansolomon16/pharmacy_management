<script setup>
/** A lab result with its abnormal-flag colouring (critical results are unmistakable). */
import { computed } from 'vue'

const props = defineProps({ item: { type: Object, required: true } })

const tone = computed(() => ({
  critical: 'bg-rose-600 text-white',
  high: 'bg-orange-100 text-orange-800',
  low: 'bg-orange-100 text-orange-800',
  positive: 'bg-rose-100 text-rose-800',
  negative: 'bg-emerald-50 text-emerald-700',
  normal: 'bg-emerald-50 text-emerald-700',
})[props.item.flag] ?? 'bg-slate-100 text-slate-600')

const value = computed(() => {
  const i = props.item
  if (i.result_value !== null && i.result_value !== undefined && i.result_value !== '') return `${Number(i.result_value)}${i.unit ? ' ' + i.unit : ''}`
  return i.result_text
})
const arrow = computed(() => ({ high: '↑', low: '↓', critical: '‼' })[props.item.flag] ?? '')
</script>

<template>
  <span v-if="value" class="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold" :class="tone" :title="item.verified_at ? `Verified by ${item.verified_by ?? 'lab'}` : 'Not yet verified'">
    {{ arrow }} {{ value }}
    <span v-if="item.verified_at" class="opacity-70">✓</span>
  </span>
  <span v-else class="text-xs font-semibold text-slate-400 capitalize">{{ item.status }}</span>
</template>
