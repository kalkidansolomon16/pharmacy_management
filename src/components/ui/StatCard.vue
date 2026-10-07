<script setup>
import { computed } from 'vue'
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from '@heroicons/vue/20/solid'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: [Object, Function], default: null },
  tone: { type: String, default: 'brand' }, // brand | gold | sky | rose | violet
  hint: { type: String, default: '' },
  trend: { type: Number, default: null }, // percent change
  to: { type: [String, Object], default: null },
})

const tones = {
  brand: 'from-brand-500 to-brand-700 shadow-brand-600/30',
  gold: 'from-gold-300 to-gold-600 shadow-gold-600/30',
  sky: 'from-sky-400 to-sky-600 shadow-sky-600/30',
  rose: 'from-rose-400 to-rose-600 shadow-rose-600/30',
  violet: 'from-violet-400 to-violet-600 shadow-violet-600/30',
}

const component = computed(() => (props.to ? 'RouterLink' : 'div'))
</script>

<template>
  <component :is="component" :to="to" class="card card-pad group relative block overflow-hidden" :class="to && 'card-hover'">
    <div class="absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br opacity-[0.07] transition group-hover:opacity-[0.12]" :class="tones[tone]" />
    <div class="relative flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-medium text-slate-500">{{ label }}</p>
        <p class="mt-2 truncate text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[1.7rem]">{{ value }}</p>
      </div>
      <span v-if="icon" class="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg" :class="tones[tone]">
        <component :is="icon" class="size-5" />
      </span>
    </div>
    <div v-if="hint || trend !== null" class="relative mt-3 flex items-center gap-2 text-xs">
      <span
        v-if="trend !== null"
        class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold"
        :class="trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
      >
        <component :is="trend >= 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon" class="size-3.5" />
        {{ Math.abs(trend).toFixed(0) }}%
      </span>
      <span class="text-slate-500">{{ hint }}</span>
    </div>
  </component>
</template>
