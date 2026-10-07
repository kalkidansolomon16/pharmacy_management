<script setup>
import { computed } from 'vue'

const props = defineProps({ password: { type: String, default: '' } })

const checks = computed(() => [
  { ok: props.password.length >= 8, label: '8+ characters' },
  { ok: /[a-z]/.test(props.password) && /[A-Z]/.test(props.password), label: 'Upper & lower case' },
  { ok: /\d/.test(props.password), label: 'A number' },
])
const score = computed(() => checks.value.filter((c) => c.ok).length)
const colors = ['bg-slate-200', 'bg-rose-500', 'bg-amber-500', 'bg-brand-500']
</script>

<template>
  <div v-if="password" class="mt-2">
    <div class="flex gap-1">
      <span v-for="i in 3" :key="i" class="h-1 flex-1 rounded-full transition" :class="i <= score ? colors[score] : 'bg-slate-200'" />
    </div>
    <ul class="mt-1.5 flex flex-wrap gap-x-3 text-[0.7rem]">
      <li v-for="c in checks" :key="c.label" :class="c.ok ? 'text-brand-700' : 'text-slate-400'">{{ c.ok ? '✓' : '○' }} {{ c.label }}</li>
    </ul>
  </div>
</template>
