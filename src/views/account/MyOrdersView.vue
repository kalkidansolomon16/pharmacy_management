<script setup>
import { ShoppingBagIcon } from '@heroicons/vue/24/outline'
import { useList } from '@/composables/useList'
import { money } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/lib/i18n'
import PillTabs from '@/components/ui/PillTabs.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import DateText from '@/components/ui/DateText.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const auth = useAuthStore()
const { t } = useI18n()
const { rows, meta, loading, filters, page } = useList('/my/orders', { status: '' }, { perPage: 10 })
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p class="text-sm font-semibold text-brand-700">Selam, {{ auth.user?.name?.split(' ')[0] }} 👋</p>
        <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">{{ t('nav.myOrders') }}</h1>
      </div>
      <RouterLink :to="{ name: 'search' }" class="btn btn-primary">Order medicine</RouterLink>
    </div>

    <PillTabs v-model="filters.status" class="mt-6" :tabs="[{ value: '', label: 'All' }, { value: 'open', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]" />

    <div class="mt-6 space-y-3">
      <template v-if="loading && !rows.length"><div v-for="i in 3" :key="i" class="skeleton h-24 rounded-2xl" /></template>
      <RouterLink v-for="o in rows" :key="o.id" :to="{ name: 'account.order', params: { id: o.id } }" class="card card-hover flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><ShoppingBagIcon class="size-6" /></span>
        <div class="min-w-0 flex-1">
          <p class="font-mono text-sm font-bold text-slate-900">{{ o.order_number }}</p>
          <p class="truncate text-sm text-slate-500">{{ o.pharmacy?.name }} · {{ o.items_count }} item(s) · <DateText :value="o.created_at" /></p>
        </div>
        <StatusBadge :status="o.status" />
        <p class="w-32 text-lg font-extrabold text-slate-900 sm:text-right">{{ money(o.total_amount) }}</p>
      </RouterLink>
      <div v-if="!loading && !rows.length" class="card py-16">
        <EmptyState title="No orders yet" text="When you order from a pharmacy, you can follow it here.">
          <RouterLink :to="{ name: 'search' }" class="btn btn-primary">Find medicine</RouterLink>
        </EmptyState>
      </div>
    </div>
    <div class="card mt-4 overflow-hidden"><AppPagination v-model="page" :meta="meta" /></div>
  </div>
</template>
