<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowPathIcon, ClockIcon, NoSymbolIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const router = useRouter()
const checking = ref(false)
const status = computed(() => auth.tenant?.status ?? auth.blockedReason?.replace('tenant_', '') ?? 'pending')

async function recheck() {
  checking.value = true
  await auth.fetchMe()
  checking.value = false
  if (auth.tenantActive) router.push(auth.homeRoute)
}

async function signOut() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="text-center">
    <span class="mx-auto grid size-20 place-items-center rounded-3xl" :class="status === 'pending' ? 'bg-gold-100 text-amber-600' : 'bg-rose-50 text-rose-600'">
      <component :is="status === 'pending' ? ClockIcon : NoSymbolIcon" class="size-10" />
    </span>
    <h1 class="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
      {{ status === 'pending' ? 'Verification in progress' : `Account ${status}` }}
    </h1>
    <p class="mx-auto mt-3 max-w-md text-slate-500">
      <template v-if="status === 'pending'">
        Thanks for registering <b class="text-slate-800">{{ auth.tenant?.name }}</b>. Our team is checking your licence
        <b class="text-slate-800">{{ auth.tenant?.license_number }}</b>. You'll get a notification as soon as you're approved - usually within 1-2 working days.
      </template>
      <template v-else>
        <b class="text-slate-800">{{ auth.tenant?.name }}</b> is currently {{ status }}. Please contact MedLink support to resolve this.
      </template>
    </p>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <button class="btn btn-primary" :disabled="checking" @click="recheck"><AppSpinner v-if="checking" /><ArrowPathIcon v-else class="size-4" /> Check status</button>
      <button class="btn btn-secondary" @click="signOut">Sign out</button>
    </div>
    <p class="mt-8 text-sm text-slate-400">Support: <a href="tel:+251911000001" class="font-semibold text-brand-700">+251 911 000 001</a> · Mon-Sat, 8:30-17:30 (2:30-11:30 Ethiopian time)</p>
  </div>
</template>
