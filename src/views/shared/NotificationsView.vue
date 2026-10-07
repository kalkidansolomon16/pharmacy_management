<script setup>
import { useRouter } from 'vue-router'
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/vue/24/solid'
import { useList } from '@/composables/useList'
import { useNotificationStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/ui/PageHeader.vue'
import PillTabs from '@/components/ui/PillTabs.vue'
import DateText from '@/components/ui/DateText.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
const auth = useAuthStore()
const store = useNotificationStore()
const { rows, meta, loading, filters, page, reload } = useList('/notifications', { unread: '' }, { perPage: 20 })

const icons = { success: CheckCircleIcon, warning: ExclamationTriangleIcon, danger: XCircleIcon, info: InformationCircleIcon }
const colors = { success: 'text-brand-500 bg-brand-50', warning: 'text-amber-500 bg-amber-50', danger: 'text-rose-500 bg-rose-50', info: 'text-sky-500 bg-sky-50' }

async function open(n) {
  await store.markRead(n)
  if (n.link) router.push(n.link)
}
async function readAll() {
  await store.markAllRead()
  reload()
}
</script>

<template>
  <div :class="!auth.isStaffUser && 'mx-auto max-w-4xl px-4 py-10 sm:px-6'">
    <PageHeader title="Notifications" subtitle="Order updates, stock and expiry alerts, prescriptions.">
      <button class="btn btn-secondary" @click="readAll">Mark all as read</button>
    </PageHeader>
    <PillTabs v-model="filters.unread" :tabs="[{ value: '', label: 'All' }, { value: '1', label: 'Unread', count: meta.unread_count }]" />
    <div class="card mt-4 overflow-hidden">
      <ul class="divide-y divide-slate-100">
        <li v-for="n in rows" :key="n.id">
          <button class="flex w-full gap-4 px-5 py-4 text-left transition hover:bg-slate-50" :class="!n.read_at && 'bg-brand-50/40'" @click="open(n)">
            <span class="grid size-10 shrink-0 place-items-center rounded-2xl" :class="colors[n.level]"><component :is="icons[n.level]" class="size-5" /></span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2 font-semibold text-slate-900">{{ n.title }} <span v-if="!n.read_at" class="size-2 rounded-full bg-brand-500" /></span>
              <span class="block text-sm text-slate-600">{{ n.message }}</span>
            </span>
            <span class="shrink-0 text-xs text-slate-400"><DateText :value="n.created_at" relative /></span>
          </button>
        </li>
      </ul>
      <div v-if="loading && !rows.length" class="space-y-2 p-5"><div v-for="i in 5" :key="i" class="skeleton h-14" /></div>
      <EmptyState v-if="!loading && !rows.length" class="py-16" title="No notifications" text="You're all caught up." />
      <AppPagination v-model="page" :meta="meta" />
    </div>
  </div>
</template>
