<script setup>
import { useRouter } from 'vue-router'
import { ArrowRightStartOnRectangleIcon, ClipboardDocumentCheckIcon, ShoppingBagIcon, Squares2X2Icon, UserCircleIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/lib/i18n'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'

defineProps({ dark: { type: Boolean, default: false } })
const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

async function signOut() {
  await auth.logout()
  router.push({ name: 'home' })
}
</script>

<template>
  <DropdownMenu width="w-64">
    <template #trigger>
      <button class="flex items-center gap-2 rounded-full p-0.5 pr-2 transition" :class="dark ? 'hover:bg-white/10' : 'hover:bg-slate-100'">
        <UserAvatar :name="auth.user?.name" size="sm" />
        <span class="hidden text-left leading-tight lg:block">
          <span class="block max-w-32 truncate text-sm font-semibold" :class="dark ? 'text-white' : 'text-slate-800'">{{ auth.user?.name }}</span>
          <span class="block text-xs" :class="dark ? 'text-white/60' : 'text-slate-500'">{{ auth.roleLabel }}</span>
        </span>
      </button>
    </template>
    <div class="border-b border-slate-100 px-4 py-3">
      <p class="truncate text-sm font-semibold text-slate-900">{{ auth.user?.name }}</p>
      <p class="truncate text-xs text-slate-500">{{ auth.user?.email }}</p>
      <p v-if="auth.tenant" class="mt-1 truncate text-xs font-medium text-brand-700">{{ auth.tenant.name }}</p>
    </div>
    <nav class="p-1.5 text-sm">
      <RouterLink v-if="auth.isStaffUser" :to="{ name: 'app.dashboard' }" class="flex items-center gap-3 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">
        <Squares2X2Icon class="size-4.5 text-slate-400" /> {{ t('nav.dashboard') }}
      </RouterLink>
      <template v-else>
        <RouterLink :to="{ name: 'account.orders' }" class="flex items-center gap-3 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">
          <ShoppingBagIcon class="size-4.5 text-slate-400" /> {{ t('nav.myOrders') }}
        </RouterLink>
        <RouterLink :to="{ name: 'prescription-check' }" class="flex items-center gap-3 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">
          <ClipboardDocumentCheckIcon class="size-4.5 text-slate-400" /> {{ t('nav.checkPrescription') }}
        </RouterLink>
      </template>
      <RouterLink :to="{ name: auth.isStaffUser ? 'app.profile' : 'account.profile' }" class="flex items-center gap-3 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">
        <UserCircleIcon class="size-4.5 text-slate-400" /> {{ t('nav.profile') }}
      </RouterLink>
      <button class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-rose-600 hover:bg-rose-50" @click="signOut">
        <ArrowRightStartOnRectangleIcon class="size-4.5" /> {{ t('nav.signOut') }}
      </button>
    </nav>
  </DropdownMenu>
</template>
