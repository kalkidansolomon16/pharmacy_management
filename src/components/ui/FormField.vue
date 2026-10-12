<script setup>
defineProps({
  label: { type: String, default: '' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  required: { type: Boolean, default: false },
  labelAm: { type: String, default: '' },
})
</script>

<template>
  <div>
    <label v-if="label" class="field-label">
      {{ label }}
      <span v-if="labelAm" class="font-am ml-1 text-xs font-normal text-slate-400">{{ labelAm }}</span>
      <span v-if="required" class="text-rose-500">*</span>
    </label>
    <slot />
    <p v-if="error" class="field-error">{{ error }}</p>
    <p v-else-if="hint" class="field-hint">{{ hint }}</p>
  </div>
</template>
