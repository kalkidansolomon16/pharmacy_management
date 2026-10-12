<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] }, // [{ label, value, sub? }]
  format: { type: Function, default: (v) => v },
  color: { type: String, default: 'from-brand-400 to-brand-600' },
})
const max = computed(() => Math.max(...props.items.map((i) => Number(i.value)), 1))
</script>

<template>
  <ul class="space-y-3">
    <li v-for="(item, i) in items" :key="item.label + i">
      <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span class="min-w-0 truncate">
          <span class="mr-1.5 text-xs font-bold text-slate-400">{{ i + 1 }}</span>
          <span class="font-medium text-slate-700">{{ item.label }}</span>
          <span v-if="item.sub" class="ml-1.5 text-xs text-slate-400">{{ item.sub }}</span>
        </span>
        <span class="shrink-0 font-semibold text-slate-900">{{ format(item.value) }}</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-slate-100">
        <div class="h-full rounded-full bg-gradient-to-r transition-all duration-700" :class="color" :style="{ width: (Number(item.value) / max) * 100 + '%' }" />
      </div>
    </li>
  </ul>
</template>
