<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  points: { type: Array, default: () => [] }, // [{ date: 'YYYY-MM-DD', value }]
  height: { type: Number, default: 240 },
  format: { type: Function, default: (v) => v },
  color: { type: String, default: '#059669' },
  label: { type: String, default: '' },
})

const root = ref(null)
const width = ref(600)
const hover = ref(null)
let observer

onMounted(() => {
  observer = new ResizeObserver(([entry]) => (width.value = Math.max(240, entry.contentRect.width)))
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

const pad = { top: 16, right: 12, bottom: 28, left: 48 }
const id = `g${Math.random().toString(36).slice(2, 8)}`

const max = computed(() => {
  const m = Math.max(...props.points.map((p) => Number(p.value)), 0)
  if (m === 0) return 1
  const mag = 10 ** Math.floor(Math.log10(m))
  return Math.ceil(m / mag) * mag
})

const coords = computed(() => {
  const n = props.points.length
  const w = width.value - pad.left - pad.right
  const h = props.height - pad.top - pad.bottom
  return props.points.map((p, i) => ({
    x: pad.left + (n <= 1 ? w / 2 : (i / (n - 1)) * w),
    y: pad.top + h - (Number(p.value) / max.value) * h,
    ...p,
  }))
})

/** Monotone cubic interpolation keeps the curve from overshooting below zero. */
const line = computed(() => {
  const pts = coords.value
  if (!pts.length) return ''
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const t = 0.18
    const c1x = p1.x + (p2.x - p0.x) * t
    const c1y = Math.min(p1.y + (p2.y - p0.y) * t, props.height - pad.bottom)
    const c2x = p2.x - (p3.x - p1.x) * t
    const c2y = Math.min(p2.y - (p3.y - p1.y) * t, props.height - pad.bottom)
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
})

const area = computed(() => {
  const pts = coords.value
  if (!pts.length) return ''
  const base = props.height - pad.bottom
  return `${line.value} L${pts.at(-1).x},${base} L${pts[0].x},${base} Z`
})

const grid = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => ({
  y: pad.top + (props.height - pad.top - pad.bottom) * (1 - f),
  label: shortNumber(max.value * f),
})))

const xLabels = computed(() => {
  const pts = coords.value
  const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor(width.value / 90))))
  return pts.filter((_, i) => i % every === 0 || i === pts.length - 1)
})

function shortNumber(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : Math.round(n)
}

const dayLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

function onMove(e) {
  const rect = root.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  let nearest = null
  for (const p of coords.value) if (!nearest || Math.abs(p.x - x) < Math.abs(nearest.x - x)) nearest = p
  hover.value = nearest
}

const total = computed(() => props.points.reduce((s, p) => s + Number(p.value), 0))
defineExpose({ total })
</script>

<template>
  <div ref="root" class="relative w-full select-none" :style="{ height: height + 'px' }" @mousemove="onMove" @mouseleave="hover = null">
    <svg :width="width" :height="height" class="overflow-visible">
      <defs>
        <linearGradient :id="id" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.28" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g>
        <line v-for="g in grid" :key="g.y" :x1="pad.left" :x2="width - pad.right" :y1="g.y" :y2="g.y" stroke="#e2e8f0" stroke-dasharray="3 5" />
        <text v-for="g in grid" :key="'l' + g.y" :x="pad.left - 10" :y="g.y + 4" text-anchor="end" class="fill-slate-400 text-[11px]">{{ g.label }}</text>
      </g>
      <path :d="area" :fill="`url(#${id})`" />
      <path :d="line" fill="none" :stroke="color" stroke-width="2.5" stroke-linecap="round" />
      <text v-for="p in xLabels" :key="p.date" :x="p.x" :y="height - 6" text-anchor="middle" class="fill-slate-400 text-[11px]">{{ dayLabel(p.date) }}</text>
      <g v-if="hover">
        <line :x1="hover.x" :x2="hover.x" :y1="pad.top" :y2="height - pad.bottom" :stroke="color" stroke-opacity="0.35" stroke-dasharray="4 4" />
        <circle :cx="hover.x" :cy="hover.y" r="6" :fill="color" fill-opacity="0.18" />
        <circle :cx="hover.x" :cy="hover.y" r="3.5" fill="white" :stroke="color" stroke-width="2.5" />
      </g>
    </svg>
    <div
      v-if="hover"
      class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-slate-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-xl"
      :style="{ left: hover.x + 'px', top: hover.y - 10 + 'px' }"
    >
      <p class="text-slate-400">{{ dayLabel(hover.date) }}</p>
      <p class="font-bold">{{ format(hover.value) }}</p>
    </div>
  </div>
</template>
