<script setup>
import { onMounted, ref } from 'vue'
import { ComputerDesktopIcon, DevicePhoneMobileIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { useFormat } from '@/composables/useFormat'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'

const ui = useUiStore()
const { dateTime, relative } = useFormat()
const sessions = ref(null)
const load = async () => (sessions.value = (await api.get('/auth/sessions')).data.data)
onMounted(load)

const isPhone = (device) => /android|iphone|mobile/i.test(device)
const label = (device) => {
  const browser = /edg/i.test(device) ? 'Edge' : /chrome/i.test(device) ? 'Chrome' : /firefox/i.test(device) ? 'Firefox' : /safari/i.test(device) ? 'Safari' : null
  const os = /windows/i.test(device) ? 'Windows' : /android/i.test(device) ? 'Android' : /iphone|ipad|mac os/i.test(device) ? 'Apple' : /linux/i.test(device) ? 'Linux' : null
  return browser || os ? [browser, os].filter(Boolean).join(' on ') : device
}
async function signOut(s) {
  if (!(await ui.confirm({ title: 'Sign out this device?', confirmText: 'Sign out', danger: true }))) return
  try {
    await api.delete(`/auth/sessions/${s.id}`)
    ui.success('Device signed out.')
    load()
  } catch (e) {
    ui.error(e.message)
  }
}
</script>

<template>
  <div>
    <PageHeader title="Signed-in devices" eyebrow="Security" subtitle="Every staff member has their own account. If a phone or computer is lost or shared, sign it out here." />
    <div v-if="!sessions" class="skeleton h-48 rounded-2xl" />
    <ul v-else class="card divide-y divide-slate-100">
      <li v-for="s in sessions" :key="s.id" class="flex items-center gap-4 px-5 py-4">
        <component :is="isPhone(s.device) ? DevicePhoneMobileIcon : ComputerDesktopIcon" class="size-8 text-slate-400" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-slate-900">{{ label(s.device) }} <span v-if="s.current" class="chip ml-1 bg-emerald-50 text-emerald-700 ring-emerald-600/15">This device</span></p>
          <p class="text-xs text-slate-500">Signed in {{ dateTime(s.created_at) }} · {{ s.last_used_at ? 'active ' + relative(s.last_used_at) : 'not used since' }}</p>
        </div>
        <button v-if="!s.current" class="btn btn-ghost btn-sm text-rose-600" @click="signOut(s)">Sign out</button>
      </li>
    </ul>
  </div>
</template>
