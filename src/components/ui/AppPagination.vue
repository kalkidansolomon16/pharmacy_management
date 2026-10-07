<script setup>
import { computed } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/20/solid'

const props = defineProps({
  meta: { type: Object, required: true },
})
const page = defineModel({ type: Number, default: 1 })

const pages = computed(() => {
  const last = props.meta.last_page || 1
  const current = props.meta.current_page || 1
  const set = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last))
  const sorted = [...set].sort((a, b) => a - b)
  const out = []
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…')
    out.push(p)
  })
  return out
})
</script>

<template>
  <div v-if="meta.total" class="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm sm:flex-row">
    <p class="text-slate-500">
      Showing <span class="font-semibold text-slate-700">{{ meta.from }}–{{ meta.to }}</span> of
      <span class="font-semibold text-slate-700">{{ meta.total }}</span>
    </p>
    <nav v-if="meta.last_page > 1" class="flex items-center gap-1">
      <button class="btn-icon size-8" :disabled="page <= 1" @click="page--"><ChevronLeftIcon class="size-4" /></button>
      <template v-for="(p, i) in pages" :key="i">
        <span v-if="p === '…'" class="px-1 text-slate-400">…</span>
        <button
          v-else
          class="min-w-8 rounded-lg px-2 py-1 text-sm font-semibold transition"
          :class="p === meta.current_page ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'"
          @click="page = p"
        >
          {{ p }}
        </button>
      </template>
      <button class="btn-icon size-8" :disabled="page >= meta.last_page" @click="page++"><ChevronRightIcon class="size-4" /></button>
    </nav>
  </div>
</template>
