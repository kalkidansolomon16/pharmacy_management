<script setup>
import { watch } from 'vue'
import api from '@/lib/api'
import { addDaysIso, money, todayIso } from '@/lib/format'
import { useForm } from '@/composables/useForm'
import { useMetaStore } from '@/stores/meta'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const props = defineProps({ open: Boolean, listing: { type: Object, default: null } })
const emit = defineEmits(['close', 'saved'])
const meta = useMetaStore()
meta.load()

const blank = () => ({ batch_number: '', quantity: '', expiry_date: addDaysIso(365), purchase_price: '', supplier: 'EPSS (Ethiopian Pharmaceutical Supply Service)', received_at: todayIso() })
const form = useForm(blank())
watch(() => props.open, (o) => o && form.reset(blank()))

async function submit() {
  await form.submit(() => api.post(`/inventory/${props.listing.id}/batches`, form.data), { onSuccess: () => emit('saved') }).catch(() => {})
}
</script>

<template>
  <AppModal :open="open" title="Receive stock" :subtitle="listing?.medicine?.display_name" @close="emit('close')">
    <form id="receive-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="submit">
      <FormField label="Batch / lot number" :error="form.errors.value.batch_number" required>
        <input v-model="form.data.batch_number" class="input font-mono uppercase" placeholder="e.g. EPH-24117A" required />
      </FormField>
      <FormField :label="`Quantity (${listing?.medicine?.unit ?? 'units'})`" :error="form.errors.value.quantity" required>
        <input v-model="form.data.quantity" type="number" min="1" class="input" required />
      </FormField>
      <FormField label="Expiry date" :error="form.errors.value.expiry_date" hint="Expired stock can't be received" required>
        <input v-model="form.data.expiry_date" type="date" :min="addDaysIso(1)" class="input" required />
      </FormField>
      <FormField label="Purchase price per unit (ETB)" :error="form.errors.value.purchase_price" :hint="listing ? `Selling at ${money(listing.price)}` : ''" required>
        <input v-model="form.data.purchase_price" type="number" min="0" step="0.01" class="input" required />
      </FormField>
      <FormField label="Supplier" :error="form.errors.value.supplier">
        <select v-model="form.data.supplier" class="input">
          <option v-for="s in meta.suppliers" :key="s" :value="s">{{ s }}</option>
        </select>
      </FormField>
      <FormField label="Received on" :error="form.errors.value.received_at">
        <input v-model="form.data.received_at" type="date" :max="todayIso()" class="input" />
      </FormField>
    </form>
    <template #footer>
      <button class="btn btn-secondary" @click="emit('close')">Cancel</button>
      <button form="receive-form" class="btn btn-primary" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Receive stock</button>
    </template>
  </AppModal>
</template>
