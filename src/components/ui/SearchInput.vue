<script setup>
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/20/solid'

defineProps({ placeholder: { type: String, default: 'Search…' } })
const model = defineModel({ type: String, default: '' })
</script>

<template>
  <div class="relative">
    <MagnifyingGlassIcon class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
    <input v-model="model" type="search" class="input pr-9 pl-10" :placeholder="placeholder" />
    <button v-if="model" class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600" @click="model = ''">
      <XMarkIcon class="size-4" />
    </button>
  </div>
</template>
