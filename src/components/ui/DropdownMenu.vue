<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps({
  align: { type: String, default: 'right' },
  width: { type: String, default: 'w-56' },
})
const open = ref(false)
const root = ref(null)

const onDocClick = (e) => {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

defineExpose({ close: () => (open.value = false) })
</script>

<template>
  <div ref="root" class="relative">
    <div @click="open = !open"><slot name="trigger" :open="open" /></div>
    <Transition name="pop">
      <div
        v-if="open"
        class="absolute z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10"
        :class="[width, align === 'right' ? 'right-0' : 'left-0']"
        @click="open = false"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>
