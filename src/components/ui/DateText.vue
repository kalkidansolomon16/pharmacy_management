<script setup>
/** A date in the user's preferred calendar, with the other calendar on hover. */
import { useFormat } from '@/composables/useFormat'

defineProps({
  value: { type: [String, Date], default: null },
  time: { type: Boolean, default: false },
  relative: { type: Boolean, default: false },
})
const f = useFormat()
</script>

<template>
  <time v-if="value" :datetime="String(value)" :title="f.altDate(value)" class="whitespace-nowrap">
    <template v-if="relative">{{ f.relative(value) }}</template>
    <template v-else>{{ time ? f.dateTime(value) : f.date(value) }}</template>
  </time>
  <span v-else class="text-slate-400">—</span>
</template>
