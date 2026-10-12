<script setup>
defineProps({ label: { type: String, default: '' }, description: { type: String, default: '' } })
const model = defineModel({ type: Boolean, default: false })
</script>

<template>
  <label class="flex cursor-pointer items-start justify-between gap-4">
    <span v-if="label || description" class="min-w-0">
      <span class="block text-sm font-semibold text-slate-800">{{ label }}</span>
      <span v-if="description" class="block text-xs text-slate-500">{{ description }}</span>
    </span>
    <button
      type="button"
      role="switch"
      :aria-checked="model"
      class="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-4 focus-visible:ring-brand-500/20 focus-visible:outline-none"
      :class="model ? 'bg-brand-600' : 'bg-slate-300'"
      @click="model = !model"
    >
      <span class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform" :class="model && 'translate-x-5'" />
    </button>
  </label>
</template>
