<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { BellIcon } from '@heroicons/vue/24/outline'
import { BellAlertIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/vue/24/solid'
import { useNotificationStore } from '@/stores/notifications'
import { relative } from '@/lib/format'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'

defineProps({ allLink: { type: Object, default: () => ({ name: 'app.notifications' }) } })

const store = useNotificationStore()
const router = useRouter()
const icons = { success: CheckCircleIcon, warning: ExclamationTriangleIcon, danger: XCircleIcon, info: InformationCircleIcon }
const colors = { success: 'text-brand-500 bg-brand-50', warning: 'text-amber-500 bg-amber-50', danger: 'text-rose-500 bg-rose-50', info: 'text-sky-500 bg-sky-50' }

onMounted(store.start)
onBeforeUnmount(store.stop)

async function open(n) {
  await store.markRead(n)
  if (n.link) router.push(n.link)
}
</script>

<template>
  <DropdownMenu width="w-[22rem]">
    <template #trigger>
      <button class="btn-icon relative" aria-label="Notifications">
        <component :is="store.unread ? BellAlertIcon : BellIcon" class="size-5.5" :class="store.unread && 'text-brand-600'" />
        <span v-if="store.unread" class="absolute top-1 right-1 grid min-w-4.5 place-items-center rounded-full bg-rose-500 px-1 text-[0.6rem] font-bold text-white ring-2 ring-white">
          {{ store.unread > 9 ? '9+' : store.unread }}
        </span>
      </button>
    </template>
    <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
      <p class="text-sm font-bold text-slate-900">Notifications</p>
      <button v-if="store.unread" class="text-xs font-semibold text-brand-700 hover:underline" @click.stop="store.markAllRead">Mark all read</button>
    </div>
    <ul class="max-h-96 divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
      <li v-for="n in store.items" :key="n.id">
        <button class="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50" :class="!n.read_at && 'bg-brand-50/40'" @click="open(n)">
          <span class="grid size-8 shrink-0 place-items-center rounded-xl" :class="colors[n.level]"><component :is="icons[n.level]" class="size-4.5" /></span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="truncate text-sm font-semibold text-slate-900">{{ n.title }}</span>
              <span v-if="!n.read_at" class="size-1.5 shrink-0 rounded-full bg-brand-500" />
            </span>
            <span class="line-clamp-2 text-xs text-slate-600">{{ n.message }}</span>
            <span class="mt-0.5 block text-[0.7rem] text-slate-400">{{ relative(n.created_at) }}</span>
          </span>
        </button>
      </li>
      <li v-if="!store.items.length" class="px-4 py-10 text-center text-sm text-slate-500">You're all caught up 🎉</li>
    </ul>
    <RouterLink :to="allLink" class="block border-t border-slate-100 py-2.5 text-center text-xs font-semibold text-brand-700 hover:bg-slate-50">View all</RouterLink>
  </DropdownMenu>
</template>
