<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, MapPinIcon } from '@heroicons/vue/24/outline'
import { useMetaStore } from '@/stores/meta'

/**
 * City picker with every Ethiopian city, grouped by region, in a scrollable list with a search box.
 * Cities that already have pharmacies on MedLink are listed first, with how many.
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  /** Label for "no city chosen", e.g. "Any city" */
  anyLabel: { type: String, default: 'Any city' },
  /** Extra classes for the button (height, background...) */
  buttonClass: { type: String, default: 'input h-12' },
  /** Show the map-pin icon inside the button */
  icon: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const meta = useMetaStore()
const open = ref(false)
const query = ref('')
const root = ref(null)
const searchBox = ref(null)

const counts = computed(() => {
  const raw = meta.meta?.pharmacies_per_city
  return raw && !Array.isArray(raw) ? raw : {}
})
const matches = (city) => city.toLowerCase().includes(query.value.trim().toLowerCase())

/** [{ label, cities: [{ name, count }] }] - "With pharmacies" first, then every region */
const groups = computed(() => {
  const withPharmacies = Object.keys(counts.value)
    .filter(matches)
    .sort()
    .map((name) => ({ name, count: counts.value[name] }))
  const regions = meta.regions
    .map((r) => ({
      label: r.name,
      cities: r.cities.filter(matches).map((name) => ({ name, count: counts.value[name] ?? 0 })),
    }))
    .filter((g) => g.cities.length)
  return [...(withPharmacies.length ? [{ label: 'With pharmacies on MedLink', cities: withPharmacies, highlight: true }] : []), ...regions]
})
const total = computed(() => meta.allCities.length)

async function toggle() {
  open.value = !open.value
  if (open.value) {
    query.value = ''
    await nextTick()
    searchBox.value?.focus()
  }
}
function choose(city) {
  emit('update:modelValue', city)
  open.value = false
}
const onOutside = (e) => open.value && root.value && !root.value.contains(e.target) && (open.value = false)
const onKey = (e) => e.key === 'Escape' && (open.value = false)
onMounted(() => {
  meta.load()
  document.addEventListener('mousedown', onOutside)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onOutside)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="relative">
    <button type="button" class="flex w-full items-center gap-2 text-left" :class="buttonClass" :aria-expanded="open" aria-haspopup="listbox" @click="toggle">
      <MapPinIcon v-if="icon" class="size-5 shrink-0 text-slate-400" />
      <span class="flex-1 truncate" :class="!props.modelValue && 'text-slate-500'">{{ props.modelValue || anyLabel }}</span>
      <ChevronDownIcon class="size-4 shrink-0 text-slate-400 transition" :class="open && 'rotate-180'" />
    </button>

    <div v-if="open" class="absolute top-full left-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white text-left shadow-2xl ring-1 ring-slate-200">
      <div class="border-b border-slate-100 p-2">
        <label class="relative block">
          <MagnifyingGlassIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input ref="searchBox" v-model="query" type="search" class="h-10 w-full rounded-xl border-0 bg-slate-50 pr-3 pl-9 text-sm text-slate-800 focus:ring-2 focus:ring-brand-500/30 focus:outline-none" :placeholder="`Search ${total} cities…`" />
        </label>
      </div>
      <ul class="max-h-72 overflow-y-auto overscroll-contain py-1" role="listbox">
        <li v-if="!query">
          <button type="button" class="flex w-full items-center justify-between px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" @click="choose('')">
            {{ anyLabel }} <CheckIcon v-if="!props.modelValue" class="size-4 text-brand-600" />
          </button>
        </li>
        <li v-for="g in groups" :key="g.label">
          <p class="sticky top-0 z-10 bg-white/95 px-4 pt-2 pb-1 text-[0.68rem] font-bold tracking-wide uppercase backdrop-blur" :class="g.highlight ? 'text-brand-700' : 'text-slate-400'">{{ g.label }}</p>
          <button
            v-for="c in g.cities"
            :key="`${g.label}-${c.name}`"
            type="button"
            role="option"
            :aria-selected="c.name === props.modelValue"
            class="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-brand-50"
            :class="c.name === props.modelValue ? 'font-bold text-brand-800' : 'text-slate-700'"
            @click="choose(c.name)"
          >
            <span class="flex-1 text-left">{{ c.name }}</span>
            <span v-if="c.count" class="rounded-full bg-brand-100 px-2 py-0.5 text-[0.68rem] font-bold text-brand-800">{{ c.count }} {{ c.count === 1 ? 'pharmacy' : 'pharmacies' }}</span>
            <CheckIcon v-if="c.name === props.modelValue" class="size-4 text-brand-600" />
          </button>
        </li>
        <li v-if="!groups.length" class="px-4 py-6 text-center text-sm text-slate-400">No city matches “{{ query }}”</li>
      </ul>
    </div>
  </div>
</template>
