<script setup>
defineProps({
  dark: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <span class="inline-flex items-center gap-2.5">
    <span class="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-800 shadow-lg shadow-brand-900/25">
      <svg viewBox="0 0 24 24" class="size-5 text-white" fill="currentColor" aria-hidden="true">
        <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />
      </svg>
      <span class="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 bg-gold-400" :class="dark ? 'border-brand-950' : 'border-white'" />
    </span>
    <span v-if="!compact" class="leading-tight">
      <span class="block text-[1.05rem] font-extrabold tracking-tight" :class="dark ? 'text-white' : 'text-slate-900'">
        Med<span :class="dark ? 'text-gold-400' : 'text-brand-600'">Link</span>
      </span>
      <span class="block text-[0.68rem] font-semibold tracking-[0.18em] uppercase" :class="dark ? 'text-brand-200/70' : 'text-slate-400'">
        Ethiopia · <span class="font-am tracking-normal normal-case">ኢትዮጵያ</span>
      </span>
    </span>
  </span>
</template>
