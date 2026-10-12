<script setup>
import { onBeforeUnmount, watch } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg | xl
  persistent: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

function onKey(e) {
  if (e.key === 'Escape' && props.open && !props.persistent) emit('close')
}

watch(() => props.open, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  open ? window.addEventListener('keydown', onKey) : window.removeEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-50 overflow-y-auto">
        <div class="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" @click="!persistent && emit('close')" />
        <div class="relative flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
          <Transition name="pop" appear>
            <div
              class="relative w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
              :class="widths[size]"
              role="dialog"
              aria-modal="true"
            >
              <div class="flag-ribbon h-1" />
              <header v-if="title || $slots.header" class="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <slot name="header">
                  <div>
                    <h2 class="text-lg font-bold text-slate-900">{{ title }}</h2>
                    <p v-if="subtitle" class="mt-0.5 text-sm text-slate-500">{{ subtitle }}</p>
                  </div>
                </slot>
                <button class="btn-icon -mr-2 -mt-1" aria-label="Close" @click="emit('close')">
                  <XMarkIcon class="size-5" />
                </button>
              </header>
              <div class="max-h-[75vh] overflow-y-auto px-6 py-5 scrollbar-thin">
                <slot />
              </div>
              <footer v-if="$slots.footer" class="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:justify-end">
                <slot name="footer" />
              </footer>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
