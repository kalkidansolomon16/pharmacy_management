<script setup>
defineProps({
  title: { type: String, default: 'Nothing here yet' },
  text: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
})
</script>

<template>
  <div class="flex flex-col items-center px-6 text-center">
    <div class="relative mb-4">
      <div class="absolute inset-0 scale-150 rounded-full bg-brand-100/60 blur-xl" />
      <div class="relative grid size-16 place-items-center rounded-2xl border border-brand-100 bg-white shadow-soft">
        <component :is="icon" v-if="icon" class="size-7 text-brand-600" />
        <svg v-else viewBox="0 0 48 48" class="size-9" fill="none">
          <rect x="8" y="14" width="32" height="26" rx="6" class="fill-brand-50 stroke-brand-500" stroke-width="2.5" />
          <path d="M17 14v-3a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" class="stroke-brand-500" stroke-width="2.5" />
          <path d="M24 21v12M18 27h12" class="stroke-gold-500" stroke-width="3" stroke-linecap="round" />
        </svg>
      </div>
    </div>
    <h3 class="text-base font-bold text-slate-900">{{ title }}</h3>
    <p v-if="text" class="mt-1 max-w-sm text-sm text-slate-500">{{ text }}</p>
    <div v-if="$slots.default" class="mt-4"><slot /></div>
  </div>
</template>
