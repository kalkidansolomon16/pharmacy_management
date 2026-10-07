<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
})
</script>

<template>
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0 animate-fade-up">
      <p v-if="eyebrow" class="mb-1 text-xs font-bold tracking-[0.16em] text-brand-600 uppercase">{{ eyebrow }}</p>
      <h1 class="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[1.75rem]">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 max-w-2xl text-sm text-slate-500">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
