<script setup>
/**
 * A colourful glyph per dosage form, so catalogue lists stay attractive without product photos.
 */
import { computed } from 'vue'

const props = defineProps({
  form: { type: String, default: 'Tablet' },
  size: { type: String, default: 'md' },
})

const kind = computed(() => {
  const f = (props.form || '').toLowerCase()
  if (f.includes('capsule')) return 'capsule'
  if (f.includes('syrup') || f.includes('suspension')) return 'bottle'
  if (f.includes('injection') || f.includes('iv')) return 'vial'
  if (f.includes('cream') || f.includes('ointment') || f.includes('gel')) return 'tube'
  if (f.includes('drop')) return 'drops'
  if (f.includes('inhaler')) return 'inhaler'
  if (f.includes('powder') || f.includes('sachet')) return 'sachet'
  return 'tablet'
})

const tones = {
  tablet: 'from-brand-50 to-brand-100 text-brand-700 ring-brand-200',
  capsule: 'from-rose-50 to-orange-100 text-rose-600 ring-rose-200',
  bottle: 'from-amber-50 to-gold-100 text-amber-700 ring-amber-200',
  vial: 'from-sky-50 to-sky-100 text-sky-700 ring-sky-200',
  tube: 'from-violet-50 to-fuchsia-100 text-violet-700 ring-violet-200',
  drops: 'from-cyan-50 to-cyan-100 text-cyan-700 ring-cyan-200',
  inhaler: 'from-indigo-50 to-indigo-100 text-indigo-700 ring-indigo-200',
  sachet: 'from-lime-50 to-lime-100 text-lime-700 ring-lime-200',
}
const sizes = { sm: 'size-9 rounded-xl', md: 'size-11 rounded-2xl', lg: 'size-16 rounded-3xl' }
</script>

<template>
  <span class="grid shrink-0 place-items-center bg-gradient-to-br ring-1 ring-inset" :class="[tones[kind], sizes[size]]">
    <svg viewBox="0 0 24 24" class="size-[55%]" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <template v-if="kind === 'tablet'">
        <circle cx="12" cy="12" r="8" fill="currentColor" fill-opacity=".12" /><path d="M6.5 17.5l11-11" />
      </template>
      <template v-else-if="kind === 'capsule'">
        <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" fill="currentColor" fill-opacity=".12" />
        <path d="M9.4 7.8l4.9 7" transform="rotate(0)" />
      </template>
      <template v-else-if="kind === 'bottle'">
        <path d="M9 3h6v3l2 3v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9l2-3z" fill="currentColor" fill-opacity=".12" /><path d="M7 13h10" />
      </template>
      <template v-else-if="kind === 'vial'">
        <path d="M14 3l7 7M17 6l-9.5 9.5a2.1 2.1 0 0 1-3 0 2.1 2.1 0 0 1 0-3L14 3M8 11l5 5M3 21l2.5-2.5" />
      </template>
      <template v-else-if="kind === 'tube'">
        <path d="M6 4h12l-2 13H8z" fill="currentColor" fill-opacity=".12" /><path d="M10 17v3h4v-3" />
      </template>
      <template v-else-if="kind === 'drops'">
        <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" fill="currentColor" fill-opacity=".12" />
      </template>
      <template v-else-if="kind === 'inhaler'">
        <path d="M9 3h5v8h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9z" fill="currentColor" fill-opacity=".12" /><path d="M5 15h4" />
      </template>
      <template v-else>
        <rect x="5" y="4" width="14" height="16" rx="2" fill="currentColor" fill-opacity=".12" /><path d="M5 8h14M9 13h6" />
      </template>
    </svg>
  </span>
</template>
