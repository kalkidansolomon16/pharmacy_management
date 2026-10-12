<script setup>
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/vue/24/solid'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const icons = { success: CheckCircleIcon, error: ExclamationTriangleIcon, info: InformationCircleIcon }
const colors = { success: 'text-brand-500', error: 'text-rose-500', info: 'text-sky-500' }
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:top-auto sm:right-5 sm:bottom-5 sm:left-auto sm:items-end">
    <TransitionGroup name="pop">
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur"
      >
        <component :is="icons[t.type]" class="mt-0.5 size-5 shrink-0" :class="colors[t.type]" />
        <div class="min-w-0 flex-1 text-sm">
          <p v-if="t.title" class="font-semibold text-slate-900">{{ t.title }}</p>
          <p class="text-slate-600">{{ t.message }}</p>
        </div>
        <button class="-m-1 rounded-md p-1 text-slate-400 hover:text-slate-600" @click="ui.dismiss(t.id)">
          <XMarkIcon class="size-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
