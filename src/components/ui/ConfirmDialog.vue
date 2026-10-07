<script setup>
import { ref, watch } from 'vue'
import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/vue/24/outline'
import { useUiStore } from '@/stores/ui'
import AppModal from './AppModal.vue'

const ui = useUiStore()
const text = ref('')

watch(() => ui.confirmState, () => (text.value = ''))

function accept() {
  const input = ui.confirmState?.input
  if (input?.required && !text.value.trim()) return
  ui.resolveConfirm(input ? text.value.trim() || true : true)
}
</script>

<template>
  <AppModal :open="!!ui.confirmState" size="sm" @close="ui.resolveConfirm(false)">
    <template v-if="ui.confirmState">
      <div class="flex gap-4">
        <span class="grid size-11 shrink-0 place-items-center rounded-2xl" :class="ui.confirmState.danger ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-600'">
          <component :is="ui.confirmState.danger ? ExclamationTriangleIcon : QuestionMarkCircleIcon" class="size-6" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-bold text-slate-900">{{ ui.confirmState.title }}</h3>
          <p class="mt-1 text-sm text-slate-600">{{ ui.confirmState.message }}</p>
          <div v-if="ui.confirmState.input" class="mt-4">
            <label class="field-label">{{ ui.confirmState.input.label }}</label>
            <textarea v-model="text" rows="2" class="input" :placeholder="ui.confirmState.input.placeholder" @keydown.enter.prevent="accept" />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <button class="btn btn-secondary" @click="ui.resolveConfirm(false)">Cancel</button>
      <button
        class="btn"
        :class="ui.confirmState?.danger ? 'btn-danger' : 'btn-primary'"
        :disabled="ui.confirmState?.input?.required && !text.trim()"
        @click="accept"
      >
        {{ ui.confirmState?.confirmText }}
      </button>
    </template>
  </AppModal>
</template>
