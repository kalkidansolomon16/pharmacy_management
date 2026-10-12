<script setup>
/** Type-ahead search over the facility's patient register (name, card number or phone). */
import { ref, watch } from 'vue'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { phone } from '@/lib/format'
import UserAvatar from '@/components/ui/UserAvatar.vue'

const model = defineModel({ type: Object, default: null })
defineProps({ placeholder: { type: String, default: 'Search name, card number (MRN) or phone' } })

const term = ref('')
const results = ref([])
const open = ref(false)
const loading = ref(false)
let timer

watch(term, (v) => {
  clearTimeout(timer)
  if (!v || v.length < 2) {
    results.value = []
    return
  }
  timer = setTimeout(async () => {
    loading.value = true
    try {
      results.value = (await api.get('/patients', { params: { search: v, per_page: 8 } })).data.data
      open.value = true
    } finally {
      loading.value = false
    }
  }, 250)
})

function pick(p) {
  model.value = p
  term.value = ''
  open.value = false
}
</script>

<template>
  <div class="relative">
    <div v-if="model" class="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2">
      <UserAvatar :name="model.full_name" size="sm" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-semibold text-slate-900">{{ model.full_name }}</p>
        <p class="truncate text-xs text-slate-500">{{ model.mrn || 'No card no.' }} · {{ phone(model.phone) }} · {{ model.age ?? '?' }}y {{ model.gender === 'female' ? 'F' : 'M' }}</p>
        <p v-if="model.allergies" class="text-xs font-bold text-rose-600">⚠ {{ model.allergies }}</p>
      </div>
      <button type="button" class="btn-icon size-8" @click="model = null"><XMarkIcon class="size-4" /></button>
    </div>
    <template v-else>
      <div class="relative">
        <MagnifyingGlassIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input v-model="term" class="input pl-9" :placeholder="placeholder" @focus="open = results.length > 0" />
      </div>
      <ul v-if="open && term.length >= 2" class="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl scrollbar-thin">
        <li v-if="loading" class="px-4 py-3 text-sm text-slate-500">Searching…</li>
        <li v-for="p in results" :key="p.id">
          <button type="button" class="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50" @click="pick(p)">
            <UserAvatar :name="p.full_name" size="sm" />
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold">{{ p.full_name }}</span>
              <span class="block text-xs text-slate-500">{{ p.mrn || '—' }} · {{ phone(p.phone) }}</span>
            </span>
          </button>
        </li>
        <li v-if="!loading && !results.length" class="px-4 py-3 text-sm text-slate-500">
          No patient found. <slot name="not-found" />
        </li>
      </ul>
    </template>
  </div>
</template>
