<script setup>
/**
 * Slot-driven table: <DataTable :columns :rows> with #cell-<key>="{ row }" overrides,
 * skeleton loading, empty state and optional row click.
 */
import EmptyState from './EmptyState.vue'

defineProps({
  columns: { type: Array, required: true }, // [{ key, label, class?, align? }]
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  rowKey: { type: String, default: 'id' },
  emptyTitle: { type: String, default: 'Nothing here yet' },
  emptyText: { type: String, default: '' },
  clickable: { type: Boolean, default: false },
})
const emit = defineEmits(['row-click'])

const alignClass = (c) => (c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : '')
</script>

<template>
  <div class="overflow-x-auto scrollbar-thin">
    <table class="table">
      <thead>
        <tr>
          <th v-for="c in columns" :key="c.key" :class="[alignClass(c), c.class]">{{ c.label }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        <template v-if="loading && !rows.length">
          <tr v-for="i in 6" :key="'s' + i">
            <td v-for="c in columns" :key="c.key"><div class="skeleton h-4" :style="{ width: 40 + ((i * 17 + c.key.length * 13) % 50) + '%' }" /></td>
          </tr>
        </template>
        <template v-else>
          <tr
            v-for="row in rows"
            :key="row[rowKey]"
            :class="[clickable && 'cursor-pointer', loading && 'opacity-60']"
            @click="clickable && emit('row-click', row)"
          >
            <td v-for="c in columns" :key="c.key" :class="[alignClass(c), c.class]">
              <slot :name="`cell-${c.key}`" :row="row" :value="row[c.key]">{{ row[c.key] ?? '—' }}</slot>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <EmptyState v-if="!loading && !rows.length" :title="emptyTitle" :text="emptyText" class="py-14">
      <slot name="empty" />
    </EmptyState>
  </div>
</template>
