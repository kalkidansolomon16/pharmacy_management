<script setup>
defineProps({
  tabs: { type: Array, required: true }, // [{ value, label, count? }]
})
const model = defineModel({ type: [String, Number], default: '' })
</script>

<template>
  <div class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-thin">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      class="inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition"
      :class="model === tab.value ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15' : 'text-slate-600 hover:bg-white hover:shadow-soft'"
      @click="model = tab.value"
    >
      {{ tab.label }}
      <span
        v-if="tab.count !== undefined && tab.count !== null"
        class="rounded-full px-1.5 py-px text-[0.7rem] font-bold"
        :class="model === tab.value ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'"
      >{{ tab.count }}</span>
    </button>
  </div>
</template>
