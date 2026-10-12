<script setup>
/** Fiscal receipt for an invoice: tax breakdown, insurer split and Ministry of Revenue IRN / RRN / QR. 80 mm printable. */
import { money, phone } from '@/lib/format'
import { formatEthiopian } from '@/lib/ethiopianCalendar'
import { useAuthStore } from '@/stores/auth'
import QrCode from '@/components/ui/QrCode.vue'

defineProps({ invoice: { type: Object, required: true } })
const auth = useAuthStore()
</script>

<template>
  <div class="print-area receipt-80 mx-auto w-full max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white p-5 font-mono text-xs text-slate-800">
    <div class="text-center">
      <p class="text-sm font-bold">{{ auth.tenant?.name }}</p>
      <p>{{ [auth.tenant?.sub_city, auth.tenant?.city].filter(Boolean).join(', ') }} · Tel {{ phone(auth.tenant?.phone) }}</p>
      <p v-if="auth.tenant?.tin_number">TIN {{ auth.tenant.tin_number }}<template v-if="auth.tenant?.vat_number"> · VAT reg. {{ auth.tenant.vat_number }}</template></p>
      <p class="mt-1 font-bold">{{ invoice.document_type === 'credit_note' ? 'CREDIT NOTE' : 'CASH SALES INVOICE' }}</p>
    </div>
    <div class="my-3 border-t border-dashed border-slate-300" />
    <p>No: {{ invoice.invoice_number }}</p>
    <p>Date: {{ new Date(invoice.issued_at || invoice.created_at).toLocaleString('en-GB') }}</p>
    <p class="font-am">{{ formatEthiopian(invoice.issued_at || invoice.created_at, 'am') }}</p>
    <p>Customer: {{ invoice.customer_name || 'Walk-in' }}</p>
    <p v-if="invoice.customer_tin">Buyer TIN: {{ invoice.customer_tin }}</p>
    <p v-if="invoice.payer">Payer: {{ invoice.payer.name }}<template v-if="invoice.membership"> ({{ invoice.membership.member_number }})</template></p>
    <div class="my-3 border-t border-dashed border-slate-300" />
    <div v-for="i in invoice.items" :key="i.id" class="mb-1.5">
      <p class="font-bold">{{ i.description }}</p>
      <p class="flex justify-between"><span>{{ Number(i.quantity) }} x {{ money(i.unit_price, { symbol: '' }) }}<template v-if="i.tax_rate"> +{{ (i.tax_rate * 100).toFixed(0) }}%</template></span><span>{{ money(i.line_total, { symbol: '' }) }}</span></p>
    </div>
    <div class="my-3 border-t border-dashed border-slate-300" />
    <p class="flex justify-between"><span>Subtotal</span><span>{{ money(invoice.subtotal, { symbol: '' }) }}</span></p>
    <p v-if="invoice.discount" class="flex justify-between"><span>Discount</span><span>-{{ money(invoice.discount, { symbol: '' }) }}</span></p>
    <p class="flex justify-between"><span>{{ auth.tenant?.tax_regime === 'tot' ? 'TOT' : auth.tenant?.tax_regime === 'vat' ? 'VAT 15%' : 'Tax' }}</span><span>{{ money(invoice.tax_total, { symbol: '' }) }}</span></p>
    <p class="flex justify-between text-sm font-bold"><span>TOTAL (ETB)</span><span>{{ money(invoice.total, { symbol: '' }) }}</span></p>
    <template v-if="invoice.payer_share">
      <p class="flex justify-between"><span>Insurer / credit</span><span>{{ money(invoice.payer_share, { symbol: '' }) }}</span></p>
      <p class="flex justify-between font-bold"><span>Patient pays</span><span>{{ money(invoice.patient_share, { symbol: '' }) }}</span></p>
    </template>
    <p class="flex justify-between"><span>Paid</span><span>{{ money(invoice.amount_paid, { symbol: '' }) }}</span></p>
    <p v-if="invoice.patient_balance > 0" class="flex justify-between font-bold"><span>Balance due</span><span>{{ money(invoice.patient_balance, { symbol: '' }) }}</span></p>
    <template v-if="invoice.fiscal?.irn">
      <div class="my-3 border-t border-dashed border-slate-300" />
      <p class="text-center font-bold">e-Invoice · Ministry of Revenue</p>
      <p class="break-all">IRN: {{ invoice.fiscal.irn }}</p>
      <p>RRN: {{ invoice.fiscal.rrn || 'pending registration' }}</p>
      <div v-if="invoice.fiscal.qr" class="mt-2 flex justify-center"><QrCode :value="invoice.fiscal.qr" :size="130" /></div>
    </template>
    <div class="my-3 border-t border-dashed border-slate-300" />
    <p class="text-center font-am">እናመሰግናለን! · Thank you · Galatoomaa</p>
  </div>
</template>
