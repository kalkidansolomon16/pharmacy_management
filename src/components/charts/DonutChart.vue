<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  segments: { type: Array, default: () => [] }, // [{ label, value, color }]
  size: { type: Number, default: 168 },
  format: { type: Function, default: (v) => v },
  centerLabel: { type: String, default: 'Total' },
})
const active = ref(null)

const total = computed(() => props.segments.reduce((s, x) => s + Number(x.value), 0))
const radius = 42
const circumference = 2 * Math.PI * radius

const arcs = computed(() => {
  let offset = 0
  return props.segments.map((s) => {
    const fraction = total.value ? Number(s.value) / total.value : 0
    const arc = { ...s, fraction, dash: `${Math.max(0, fraction * circumference - 2)} ${circumference}`, offset: -offset * circumference }
    offset += fraction
    return arc
  })
})

const shown = computed(() => (active.value !== null ? arcs.value[active.value] : null))
</script>

<template>
  <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
    <div class="relative shrink-0" :style="{ width: size + 'px', height: size + 'px' }">
      <svg viewBox="0 0 100 100" class="-rotate-90">
        <circle cx="50" cy="50" :r="radius" fill="none" stroke="#f1f5f9" stroke-width="12" />
        <circle
          v-for="(a, i) in arcs"
          :key="a.label"
          cx="50"
          cy="50"
          :r="radius"
          fill="none"
          :stroke="a.color"
          :stroke-width="active === i ? 15 : 12"
          :stroke-dasharray="a.dash"
          :stroke-dashoffset="a.offset"
          stroke-linecap="round"
          class="cursor-pointer transition-all duration-200"
          @mouseenter="active = i"
          @mouseleave="active = null"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span class="text-[0.7rem] font-semibold tracking-wide text-slate-400 uppercase">{{ shown ? shown.label : centerLabel }}</span>
        <span class="text-base font-extrabold text-slate-900">{{ format(shown ? shown.value : total) }}</span>
        <span v-if="shown" class="text-xs font-semibold text-slate-500">{{ (shown.fraction * 100).toFixed(0) }}%</span>
      </div>
    </div>
    <ul class="w-full space-y-2 text-sm">
      <li
        v-for="(a, i) in arcs"
        :key="a.label"
        class="flex items-center justify-between gap-3 rounded-lg px-2 py-1 transition"
        :class="active === i && 'bg-slate-50'"
        @mouseenter="active = i"
        @mouseleave="active = null"
      >
        <span class="flex min-w-0 items-center gap-2">
          <span class="size-2.5 shrink-0 rounded-full" :style="{ background: a.color }" />
          <span class="truncate text-slate-600">{{ a.label }}</span>
        </span>
        <span class="font-semibold text-slate-900">{{ (a.fraction * 100).toFixed(0) }}%</span>
      </li>
    </ul>
  </div>
</template>
