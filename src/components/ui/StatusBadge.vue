<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true },
  label: { type: String, default: '' },
  dot: { type: Boolean, default: true },
})

const tones = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/15',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
}

const map = {
  // orders
  pending: ['amber', 'Pending'],
  confirmed: ['sky', 'Confirmed'],
  ready: ['violet', 'Ready for pickup'],
  completed: ['emerald', 'Completed'],
  partially_completed: ['orange', 'Partially filled'],
  cancelled: ['slate', 'Cancelled'],
  rejected: ['rose', 'Rejected'],
  // prescriptions
  active: ['emerald', 'Active'],
  partially_dispensed: ['orange', 'Partially dispensed'],
  dispensed: ['sky', 'Dispensed'],
  expired: ['rose', 'Expired'],
  // tenants / users
  suspended: ['rose', 'Suspended'],
  inactive: ['slate', 'Inactive'],
  // stock
  in_stock: ['emerald', 'In stock'],
  low_stock: ['amber', 'Low stock'],
  out_of_stock: ['rose', 'Out of stock'],
  // expiry
  ok: ['emerald', 'Good'],
  warning: ['amber', '< 90 days'],
  critical: ['rose', '< 30 days'],
  // payment
  paid: ['emerald', 'Paid'],
  unpaid: ['amber', 'Unpaid'],
  refunded: ['slate', 'Refunded'],
  // movements
  in: ['emerald', 'Stock in'],
  out: ['sky', 'Dispensed'],
  adjustment: ['violet', 'Adjustment'],
  return: ['orange', 'Return'],
  // channels
  online: ['violet', 'Online'],
  walk_in: ['slate', 'Walk-in'],
}

const entry = computed(() => map[props.status] ?? ['slate', props.status.replace(/_/g, ' ')])
const classes = computed(() => tones[entry.value[0]])
</script>

<template>
  <span class="chip" :class="classes">
    <span v-if="dot" class="size-1.5 rounded-full bg-current opacity-70" />
    {{ label || entry[1] }}
  </span>
</template>
