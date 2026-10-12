<script setup>
import { computed } from 'vue'
import { CheckIcon, XMarkIcon } from '@heroicons/vue/20/solid'

const props = defineProps({ status: { type: String, required: true }, fulfillment: { type: String, default: 'pickup' } })

const steps = computed(() => [
  { key: 'pending', label: 'Placed', am: 'ተልኳል' },
  { key: 'confirmed', label: 'Confirmed', am: 'ተረጋግጧል' },
  { key: 'ready', label: props.fulfillment === 'delivery' ? 'On the way' : 'Ready for pickup', am: 'ዝግጁ' },
  { key: 'completed', label: 'Completed', am: 'ተጠናቋል' },
])
const order = ['pending', 'confirmed', 'ready', 'completed']
const failed = computed(() => ['cancelled', 'rejected'].includes(props.status))
const index = computed(() => (props.status === 'partially_completed' ? 3 : order.indexOf(props.status)))
</script>

<template>
  <div>
    <div v-if="failed" class="flex items-center gap-3 rounded-2xl bg-rose-50 p-4 text-rose-700">
      <span class="grid size-9 place-items-center rounded-full bg-rose-500 text-white"><XMarkIcon class="size-5" /></span>
      <p class="font-semibold">This order was {{ status }}.</p>
    </div>
    <ol v-else class="grid grid-cols-4">
      <li v-for="(s, i) in steps" :key="s.key" class="relative flex flex-col items-center text-center">
        <span v-if="i > 0" class="absolute top-4 right-1/2 h-1 w-full -translate-y-1/2 rounded-full" :class="i <= index ? 'bg-brand-500' : 'bg-slate-200'" />
        <span
          class="relative z-10 grid size-8 place-items-center rounded-full text-sm font-bold ring-4 ring-white transition"
          :class="i < index || (i === index && i === 3) ? 'bg-brand-600 text-white' : i === index ? 'bg-gold-400 text-brand-950 shadow-lg shadow-gold-500/30' : 'bg-slate-200 text-slate-400'"
        >
          <CheckIcon v-if="i < index || (i === 3 && index === 3)" class="size-4.5" /><template v-else>{{ i + 1 }}</template>
        </span>
        <span class="mt-2 text-xs font-semibold" :class="i <= index ? 'text-slate-900' : 'text-slate-400'">{{ s.label }}</span>
        <span class="font-am text-[0.65rem] text-slate-400">{{ s.am }}</span>
      </li>
    </ol>
  </div>
</template>
