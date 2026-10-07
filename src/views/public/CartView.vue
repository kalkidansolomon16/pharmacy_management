<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BuildingStorefrontIcon, CheckCircleIcon, MinusIcon, PlusIcon, ShieldExclamationIcon, ShoppingCartIcon, TrashIcon, TruckIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { money } from '@/lib/format'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { useUiStore } from '@/stores/ui'
import MedicineAvatar from '@/components/ui/MedicineAvatar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const cart = useCartStore()
const auth = useAuthStore()
const meta = useMetaStore()
const ui = useUiStore()
const router = useRouter()

/** One checkout form per pharmacy group. */
const forms = reactive({})
const errors = reactive({})
const submitting = ref(null)
const placed = ref(null)

onMounted(() => meta.load())

function formFor(pharmacyId) {
  forms[pharmacyId] ??= {
    fulfillment: 'pickup', delivery_address: auth.user?.address ?? '', payment_method: 'telebirr',
    prescription_code: '', patient_phone: auth.user?.phone ?? '', customer_phone: auth.user?.phone ?? '', notes: '',
  }
  return forms[pharmacyId]
}

async function checkout(group) {
  if (!auth.isAuthenticated) return router.push({ name: 'login', query: { redirect: '/cart' } })
  const form = formFor(group.pharmacy.id)
  submitting.value = group.pharmacy.id
  errors[group.pharmacy.id] = {}
  try {
    const { data } = await api.post('/my/orders', {
      pharmacy_id: group.pharmacy.id,
      items: group.lines.map((l) => ({ pharmacy_medicine_id: l.listingId, quantity: l.quantity })),
      ...form,
      prescription_code: form.prescription_code || null,
      patient_phone: form.prescription_code ? form.patient_phone : null,
      delivery_address: form.fulfillment === 'delivery' ? form.delivery_address : null,
    })
    cart.clearPharmacy(group.pharmacy.id)
    placed.value = data.data
  } catch (e) {
    errors[group.pharmacy.id] = e.errors
    ui.error(e.message, 'Order not placed')
  } finally {
    submitting.value = null
  }
}

const lineError = (group, line) => errors[group.pharmacy.id]?.[`items.${line.listingId}`]
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
    <h1 class="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-slate-900"><ShoppingCartIcon class="size-8 text-brand-600" /> Your cart</h1>
    <p class="mt-1 text-slate-500">Each pharmacy prepares its own order. Pay when you pick up or on delivery.</p>

    <div v-if="!cart.lines.length" class="card mt-8 py-20">
      <EmptyState title="Your cart is empty" text="Search for a medicine and add it from the pharmacy that suits you best.">
        <RouterLink :to="{ name: 'search' }" class="btn btn-primary">Find medicine</RouterLink>
      </EmptyState>
    </div>

    <div v-if="auth.isStaffUser && cart.lines.length" class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      You are signed in as staff ({{ auth.roleLabel }}). Online ordering is for customer accounts - use the Point of sale for counter sales.
    </div>

    <div class="mt-8 space-y-8">
      <section v-for="group in cart.byPharmacy" :key="group.pharmacy.id" class="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div class="card overflow-hidden">
          <header class="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
            <RouterLink :to="{ name: 'pharmacy', params: { slug: group.pharmacy.slug } }" class="flex items-center gap-3">
              <span class="grid size-10 place-items-center rounded-xl bg-brand-600 text-white"><BuildingStorefrontIcon class="size-5" /></span>
              <span><b class="block text-slate-900">{{ group.pharmacy.name }}</b><span class="text-xs text-slate-500">{{ [group.pharmacy.sub_city, group.pharmacy.city].filter(Boolean).join(', ') }}</span></span>
            </RouterLink>
            <span class="text-sm font-semibold text-slate-500">{{ group.lines.length }} item(s)</span>
          </header>
          <ul class="divide-y divide-slate-100">
            <li v-for="line in group.lines" :key="line.listingId" class="px-5 py-4">
              <div class="flex items-center gap-4">
                <MedicineAvatar :form="line.medicine.dosage_form" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-semibold text-slate-900">{{ line.medicine.display_name }}</p>
                  <p class="text-xs text-slate-500">{{ money(line.price) }} per {{ line.medicine.unit }}
                    <span v-if="line.medicine.prescription_required" class="ml-1 font-semibold text-rose-600">· Prescription required</span>
                  </p>
                </div>
                <div class="flex items-center rounded-xl border border-slate-200">
                  <button class="grid size-9 place-items-center text-slate-500 hover:text-slate-900" @click="cart.setQuantity(line.listingId, line.quantity - 1)"><MinusIcon class="size-4" /></button>
                  <input :value="line.quantity" type="number" min="1" class="w-12 border-0 text-center text-sm font-bold focus:ring-0 focus:outline-none" @change="cart.setQuantity(line.listingId, $event.target.value)" />
                  <button class="grid size-9 place-items-center text-slate-500 hover:text-slate-900" @click="cart.setQuantity(line.listingId, line.quantity + 1)"><PlusIcon class="size-4" /></button>
                </div>
                <p class="hidden w-28 text-right font-bold text-slate-900 sm:block">{{ money(line.price * line.quantity) }}</p>
                <button class="btn-icon hover:text-rose-600" aria-label="Remove" @click="cart.remove(line.listingId)"><TrashIcon class="size-5" /></button>
              </div>
              <p v-if="lineError(group, line)" class="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{{ lineError(group, line) }}</p>
            </li>
          </ul>
        </div>

        <aside class="card card-pad h-fit space-y-5 lg:sticky lg:top-24">
          <h2 class="font-bold text-slate-900">Checkout</h2>

          <div class="grid grid-cols-2 gap-2">
            <button class="rounded-xl border-2 p-3 text-left text-sm transition" :class="formFor(group.pharmacy.id).fulfillment === 'pickup' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'" @click="formFor(group.pharmacy.id).fulfillment = 'pickup'">
              <BuildingStorefrontIcon class="size-5 text-brand-600" /><b class="mt-1 block">Pickup</b><span class="text-xs text-slate-500">Collect at the counter</span>
            </button>
            <button
              class="rounded-xl border-2 p-3 text-left text-sm transition disabled:opacity-50"
              :class="formFor(group.pharmacy.id).fulfillment === 'delivery' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'"
              :disabled="!group.pharmacy.delivery_available"
              @click="formFor(group.pharmacy.id).fulfillment = 'delivery'"
            >
              <TruckIcon class="size-5 text-brand-600" /><b class="mt-1 block">Delivery</b><span class="text-xs text-slate-500">{{ group.pharmacy.delivery_available ? 'To your address' : 'Not offered' }}</span>
            </button>
          </div>

          <FormField v-if="formFor(group.pharmacy.id).fulfillment === 'delivery'" label="Delivery address" :error="errors[group.pharmacy.id]?.delivery_address" required>
            <textarea v-model="formFor(group.pharmacy.id).delivery_address" rows="2" class="input" placeholder="Sub-city, woreda, house no., landmark (e.g. near Edna Mall)" />
          </FormField>

          <div>
            <p class="field-label">Payment method</p>
            <div class="grid grid-cols-2 gap-2">
              <label v-for="p in meta.paymentMethods" :key="p.value" class="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition" :class="formFor(group.pharmacy.id).payment_method === p.value ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'">
                <input v-model="formFor(group.pharmacy.id).payment_method" type="radio" :value="p.value" class="accent-brand-600" /> {{ p.label }}
              </label>
            </div>
          </div>

          <div class="rounded-2xl border p-4" :class="group.needsPrescription ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-slate-50/50'">
            <p class="flex items-center gap-2 text-sm font-bold" :class="group.needsPrescription ? 'text-rose-700' : 'text-slate-700'">
              <ShieldExclamationIcon class="size-5" /> {{ group.needsPrescription ? 'Prescription required' : 'Have a prescription? (optional)' }}
            </p>
            <div class="mt-3 grid gap-3">
              <FormField :error="errors[group.pharmacy.id]?.prescription_code">
                <input v-model="formFor(group.pharmacy.id).prescription_code" class="input font-mono uppercase" placeholder="RX-XXXX-XXXX" />
              </FormField>
              <FormField v-if="formFor(group.pharmacy.id).prescription_code" label="Patient's phone" hint="Must match the phone on the prescription" :error="errors[group.pharmacy.id]?.patient_phone">
                <input v-model="formFor(group.pharmacy.id).patient_phone" class="input" placeholder="09XX XXX XXX" />
              </FormField>
            </div>
          </div>

          <FormField label="Note for the pharmacist">
            <input v-model="formFor(group.pharmacy.id).notes" class="input" placeholder="e.g. I'll pick it up around 6 PM" />
          </FormField>

          <div class="space-y-1 border-t border-slate-100 pt-4 text-sm">
            <div class="flex justify-between text-slate-500"><span>Subtotal</span><span>{{ money(group.total) }}</span></div>
            <div class="flex justify-between text-slate-500"><span>Delivery</span><span>{{ formFor(group.pharmacy.id).fulfillment === 'delivery' ? 'Agreed with pharmacy' : 'Free pickup' }}</span></div>
            <div class="flex justify-between pt-2 text-lg font-extrabold text-slate-900"><span>Total</span><span>{{ money(group.total) }}</span></div>
          </div>

          <button class="btn btn-primary btn-lg w-full" :disabled="submitting === group.pharmacy.id || auth.isStaffUser" @click="checkout(group)">
            <AppSpinner v-if="submitting === group.pharmacy.id" />
            {{ auth.isAuthenticated ? 'Place order' : 'Sign in to place order' }}
          </button>
          <p class="text-center text-xs text-slate-400">The pharmacy confirms availability before you pay.</p>
        </aside>
      </section>
    </div>

    <AppModal :open="!!placed" size="sm" @close="placed = null">
      <div v-if="placed" class="py-4 text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-full bg-brand-50"><CheckCircleIcon class="size-10 text-brand-600" /></span>
        <h2 class="mt-4 text-xl font-extrabold text-slate-900">Order sent!</h2>
        <p class="mt-1 text-sm text-slate-500">{{ placed.pharmacy?.name }} will confirm shortly. We'll notify you at every step.</p>
        <p class="mt-4 inline-block rounded-xl bg-slate-100 px-4 py-2 font-mono text-lg font-bold tracking-wider text-slate-900">{{ placed.order_number }}</p>
        <p class="mt-2 text-sm font-semibold text-slate-700">Total {{ money(placed.total_amount) }}</p>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="placed = null">Keep shopping</button>
        <RouterLink v-if="placed" :to="{ name: 'account.order', params: { id: placed.id } }" class="btn btn-primary">Track order</RouterLink>
      </template>
    </AppModal>
  </div>
</template>
