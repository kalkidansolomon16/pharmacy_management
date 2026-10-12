<script setup>
import { ref, watchEffect } from 'vue'
import QRCode from 'qrcode'

const props = defineProps({
  value: { type: String, required: true },
  size: { type: Number, default: 160 },
})
const svg = ref('')

watchEffect(async () => {
  svg.value = await QRCode.toString(props.value, {
    type: 'svg',
    margin: 1,
    width: props.size,
    color: { dark: '#022c22', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- generated locally by the qrcode library -->
  <div class="inline-block overflow-hidden rounded-xl bg-white p-1" :style="{ width: size + 'px' }" v-html="svg" />
</template>
