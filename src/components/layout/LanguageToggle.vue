<script setup>
import { useI18n } from '@/lib/i18n'

defineProps({ dark: { type: Boolean, default: false } })
const { locale, setLocale } = useI18n()
</script>

<template>
  <div class="inline-flex rounded-xl p-0.5 text-xs font-bold" :class="dark ? 'bg-white/10' : 'bg-slate-100'">
    <button
      v-for="opt in [{ v: 'en', l: 'EN', t: 'English' }, { v: 'am', l: 'አማ', t: 'አማርኛ' }, { v: 'om', l: 'OM', t: 'Afaan Oromoo' }]"
      :key="opt.v"
      class="rounded-[0.6rem] px-2.5 py-1 transition"
      :class="[
        opt.v === 'am' && 'font-am',
        locale === opt.v
          ? dark ? 'bg-white text-brand-900 shadow' : 'bg-white text-slate-900 shadow-sm'
          : dark ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-800',
      ]"
      :aria-pressed="locale === opt.v"
      :title="opt.t"
      @click="setLocale(opt.v)"
    >
      {{ opt.l }}
    </button>
  </div>
</template>
