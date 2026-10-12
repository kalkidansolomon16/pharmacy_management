<script setup>
import { computed, onMounted } from 'vue'
import { useList } from '@/composables/useList'
import { useMetaStore } from '@/stores/meta'
import SearchInput from '@/components/ui/SearchInput.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PharmacyCard from '@/components/public/PharmacyCard.vue'

const meta = useMetaStore()
onMounted(() => meta.load())

const { rows, meta: page, loading, filters, page: current } = useList('/public/pharmacies', { q: '', city: '', sub_city: '', open_24: '', delivery: '' }, { perPage: 12 })

const chip = (key) => computed({ get: () => !!filters[key], set: (v) => (filters[key] = v ? '1' : '') })
const open24 = chip('open_24')
const delivery = chip('delivery')
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-brand-950 text-white">
      <div class="pattern-dots absolute inset-0" />
      <div class="absolute -top-24 right-0 size-96 rounded-full bg-brand-500/25 blur-3xl" />
      <div class="relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <p class="font-am text-gold-300">ፋርማሲዎች</p>
        <h1 class="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Pharmacy directory</h1>
        <p class="mt-2 max-w-2xl text-brand-100/75">Licensed community pharmacies across Ethiopia. Open one to browse everything it has in stock.</p>
        <div class="mt-8 grid gap-3 rounded-3xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur sm:grid-cols-[1fr_12rem_12rem]">
          <SearchInput v-model="filters.q" placeholder="Pharmacy name or street…" class="[&_input]:h-12" />
          <select v-model="filters.city" class="input h-12">
            <option value="">All cities</option>
            <option v-for="c in meta.citiesWithPharmacies" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="filters.sub_city" class="input h-12" :disabled="filters.city !== 'Addis Ababa'">
            <option value="">All sub-cities</option>
            <option v-for="s in meta.subCities" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <RouterLink :to="{ name: 'pharmacies.nearby' }" class="chip bg-gold-400 px-3.5 py-1.5 text-sm font-bold text-brand-950 ring-gold-400">📍 Near me (map)</RouterLink>
          <button class="chip px-3.5 py-1.5 text-sm" :class="open24 ? 'bg-gold-400 text-brand-950 ring-gold-400' : 'bg-white/5 text-white ring-white/20'" @click="open24 = !open24">🌙 Open 24 hours</button>
          <button class="chip px-3.5 py-1.5 text-sm" :class="delivery ? 'bg-gold-400 text-brand-950 ring-gold-400' : 'bg-white/5 text-white ring-white/20'" @click="delivery = !delivery">🛵 Delivery available</button>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p class="mb-5 text-sm text-slate-500"><b class="text-slate-900">{{ page.total }}</b> pharmacies</p>
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <template v-if="loading && !rows.length"><div v-for="i in 6" :key="i" class="skeleton h-64 rounded-2xl" /></template>
        <PharmacyCard v-for="p in rows" :key="p.id" :pharmacy="p" />
      </div>
      <div v-if="!loading && !rows.length" class="card py-16"><EmptyState title="No pharmacies found" text="Try another city or clear your filters." /></div>
      <div class="card mt-6 overflow-hidden"><AppPagination v-model="current" :meta="page" /></div>
    </section>
  </div>
</template>
