<script setup>
import { ref } from 'vue'
import { useList } from '@/composables/useList'
import { titleCase } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import DateText from '@/components/ui/DateText.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const auth = useAuthStore()
const { rows, meta, loading, filters, page } = useList('/activity-logs', { search: '', entity_type: '', from: '', to: '' }, { perPage: 25 })
const expanded = ref(null)

const tone = (action) => {
  if (/delet|cancel|reject|deactivat|expired/.test(action)) return 'bg-rose-500'
  if (/creat|placed|issued|received|registered|completed/.test(action)) return 'bg-emerald-500'
  if (/login/.test(action)) return 'bg-sky-500'
  return 'bg-amber-500'
}
const fmt = (v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '∅'))
</script>

<template>
  <div>
    <PageHeader title="Audit log" :eyebrow="auth.tenant?.name ?? 'Platform-wide'" subtitle="Who did what, and when. Entries cannot be edited or deleted." />
    <div class="card overflow-hidden">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row">
        <SearchInput v-model="filters.search" class="flex-1" placeholder="Search descriptions" />
        <select v-model="filters.entity_type" class="input lg:w-48">
          <option value="">All records</option>
          <option v-for="e in ['Order', 'PharmacyMedicine', 'Prescription', 'Patient', 'User', 'Tenant', 'Medicine']" :key="e" :value="e">{{ titleCase(e.replace(/([a-z])([A-Z])/g, '$1 $2')) }}</option>
        </select>
        <input v-model="filters.from" type="date" class="input lg:w-40" />
        <input v-model="filters.to" type="date" class="input lg:w-40" />
      </div>
      <ol class="relative px-5 py-4">
        <span class="absolute top-6 bottom-6 left-[1.85rem] w-px bg-slate-200" />
        <li v-for="log in rows" :key="log.id" class="relative flex gap-4 py-3">
          <span class="relative z-10 mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-white" :class="tone(log.action)" />
          <div class="min-w-0 flex-1">
            <p class="text-sm text-slate-800">{{ log.description }}</p>
            <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span class="inline-flex items-center gap-1.5"><UserAvatar :name="log.user?.name ?? 'System'" size="sm" class="!size-5 !text-[0.55rem]" /> {{ log.user?.name ?? 'System' }}</span>
              <span>·</span><DateText :value="log.created_at" time />
              <template v-if="auth.isSuperAdmin && log.tenant"><span>·</span><span class="font-semibold text-brand-700">{{ log.tenant }}</span></template>
              <template v-if="log.ip_address"><span>·</span><span class="font-mono">{{ log.ip_address }}</span></template>
              <button v-if="log.properties" class="font-semibold text-brand-700 hover:underline" @click="expanded = expanded === log.id ? null : log.id">{{ expanded === log.id ? 'Hide' : 'Details' }}</button>
            </p>
            <div v-if="expanded === log.id" class="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-600">
              <template v-if="log.properties.new">
                <p v-for="(v, k) in log.properties.new" :key="k"><b>{{ k }}</b>: <span class="text-rose-600 line-through">{{ fmt(log.properties.old?.[k]) }}</span> → <span class="text-emerald-700">{{ fmt(v) }}</span></p>
              </template>
              <pre v-else class="whitespace-pre-wrap">{{ JSON.stringify(log.properties, null, 2) }}</pre>
            </div>
          </div>
          <span class="hidden shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[0.68rem] text-slate-500 sm:block">{{ log.action }}</span>
        </li>
      </ol>
      <div v-if="loading && !rows.length" class="space-y-3 p-5"><div v-for="i in 6" :key="i" class="skeleton h-10" /></div>
      <EmptyState v-if="!loading && !rows.length" class="py-16" title="No activity recorded" />
      <AppPagination v-model="page" :meta="meta" />
    </div>
  </div>
</template>
