<script setup>
import { computed, onMounted, ref } from 'vue'
import { MapPinIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { phone } from '@/lib/format'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormField from '@/components/ui/FormField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import LocationPicker from '@/components/maps/LocationPicker.vue'

const auth = useAuthStore()
const meta = useMetaStore()
const org = ref(null)
const form = useForm({})

// Specialties a hospital / clinic offers (patients filter and book by them)
const specialties = ref([])
const chosen = ref(new Set())
const specialtySearch = ref('')
const shownSpecialties = computed(() => {
  const q = specialtySearch.value.trim().toLowerCase()
  return q ? specialties.value.filter((s) => s.name.toLowerCase().includes(q)) : specialties.value
})
function toggleSpecialty(id) {
  const next = new Set(chosen.value)
  next.has(id) ? next.delete(id) : next.add(id)
  chosen.value = next
}

onMounted(async () => {
  meta.load()
  org.value = (await api.get('/organization')).data.data
  if (org.value.type === 'hospital') {
    api.get('/organization/specialties').then(({ data }) => {
      specialties.value = data.data.available
      chosen.value = new Set(data.data.selected)
      // Opened from the dashboard's "Choose specialties": jump to the section
      if (location.hash === '#specialties') setTimeout(() => document.getElementById('specialties')?.scrollIntoView({ behavior: 'smooth' }), 100)
    })
  }
  form.reset({
    name: org.value.name, license_number: org.value.license_number, tin_number: org.value.tin_number ?? '', phone: phone(org.value.phone),
    email: org.value.email ?? '', region: org.value.region ?? 'Addis Ababa', city: org.value.city ?? '', sub_city: org.value.sub_city ?? '',
    woreda: org.value.woreda ?? '', address_line: org.value.address_line ?? '', latitude: org.value.latitude ?? '', longitude: org.value.longitude ?? '',
    opening_hours: org.value.opening_hours ?? '', is_24_hours: org.value.is_24_hours, delivery_available: org.value.delivery_available, description: org.value.description ?? '',
  })
})

async function save() {
  const data = await form.submit(() => api.put('/organization', form.data)).catch(() => null)
  if (data && org.value?.type === 'hospital') {
    await api.put('/organization/specialties', { specialty_ids: [...chosen.value] }).catch(() => null)
  }
  if (data) {
    org.value = data.data
    auth.fetchMe()
  }
}

function useMyLocation() {
  navigator.geolocation?.getCurrentPosition((pos) => {
    form.data.latitude = pos.coords.latitude.toFixed(6)
    form.data.longitude = pos.coords.longitude.toFixed(6)
  })
}
</script>

<template>
  <div>
    <PageHeader title="Organization profile" :eyebrow="auth.tenant?.type === 'pharmacy' ? 'Pharmacy' : 'Hospital'" subtitle="This information appears on your public page, receipts and prescriptions.">
      <RouterLink v-if="org && org.type === 'pharmacy'" :to="{ name: 'pharmacy', params: { slug: org.slug } }" class="btn btn-secondary" target="_blank">View public page ↗</RouterLink>
    </PageHeader>
    <div v-if="!org" class="skeleton h-[32rem] rounded-3xl" />
    <form v-else class="grid gap-6 lg:grid-cols-[1fr_20rem]" @submit.prevent="save">
      <div class="space-y-6">
        <section class="card card-pad">
          <h2 class="font-bold text-slate-900">Registration</h2>
          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField label="Name" :error="form.errors.value.name" class="sm:col-span-2"><input v-model="form.data.name" class="input" /></FormField>
            <FormField :label="org.type === 'pharmacy' ? 'EFDA licence' : 'MoH licence'" :error="form.errors.value.license_number"><input v-model="form.data.license_number" class="input font-mono" /></FormField>
            <FormField label="TIN" :error="form.errors.value.tin_number"><input v-model="form.data.tin_number" class="input font-mono" maxlength="10" /></FormField>
            <FormField label="Phone" :error="form.errors.value.phone"><input v-model="form.data.phone" class="input" /></FormField>
            <FormField label="Email" :error="form.errors.value.email"><input v-model="form.data.email" type="email" class="input" /></FormField>
          </div>
        </section>
        <section class="card card-pad">
          <h2 class="font-bold text-slate-900">Location</h2>
          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField label="Region" label-am="ክልል"><select v-model="form.data.region" class="input"><option v-for="r in meta.regions" :key="r.name" :value="r.name">{{ r.name }} · {{ r.name_am }}</option></select></FormField>
            <FormField label="City" label-am="ከተማ"><select v-model="form.data.city" class="input"><option v-for="c in meta.citiesFor(form.data.region)" :key="c">{{ c }}</option></select></FormField>
            <FormField v-if="form.data.city === 'Addis Ababa'" label="Sub-city" label-am="ክፍለ ከተማ"><select v-model="form.data.sub_city" class="input"><option value="">—</option><option v-for="s in meta.subCities" :key="s">{{ s }}</option></select></FormField>
            <FormField label="Woreda" label-am="ወረዳ"><input v-model="form.data.woreda" class="input" /></FormField>
            <FormField label="Street / landmark" class="sm:col-span-2"><input v-model="form.data.address_line" class="input" /></FormField>
            <FormField label="Latitude" :error="form.errors.value.latitude"><input v-model="form.data.latitude" class="input font-mono" /></FormField>
            <FormField label="Longitude" :error="form.errors.value.longitude"><input v-model="form.data.longitude" class="input font-mono" /></FormField>
            <button type="button" class="btn btn-secondary btn-sm w-fit" @click="useMyLocation"><MapPinIcon class="size-4" /> Use my current location</button>
          </div>
          <div class="mt-5">
            <p class="mb-2 text-sm font-semibold text-slate-700">Pin on the map</p>
            <p class="mb-3 text-xs text-slate-500">Patients searching <b>near me</b> only find you once your location is set. Put the pin on your entrance.</p>
            <LocationPicker v-model:lat="form.data.latitude" v-model:lng="form.data.longitude" :label="form.data.name" />
          </div>
        </section>
        <section class="card card-pad">
          <h2 class="font-bold text-slate-900">Service</h2>
          <div class="mt-5 space-y-4">
            <FormField label="Opening hours"><input v-model="form.data.opening_hours" class="input" placeholder="Mon-Sat 8:00-21:00 (2:00-3:00 Ethiopian time)" /></FormField>
            <ToggleSwitch v-model="form.data.is_24_hours" label="Open 24 hours" />
            <ToggleSwitch v-if="org.type === 'pharmacy'" v-model="form.data.delivery_available" label="Home delivery" description="Customers can choose delivery at checkout" />
            <FormField label="About" hint="Shown on your public page"><textarea v-model="form.data.description" rows="3" class="input" /></FormField>
          </div>
        </section>
        <section v-if="org.type === 'hospital'" id="specialties" class="card card-pad scroll-mt-24">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="font-bold text-slate-900">Specialties</h2>
              <p class="mt-1 text-sm text-slate-500">Tick what you offer. Patients find you by these in “near me” and when booking appointments.</p>
            </div>
            <span class="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{{ chosen.size }} selected</span>
          </div>
          <input v-if="specialties.length > 10" v-model="specialtySearch" type="search" class="input mt-4" placeholder="Search specialties" />
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              v-for="s in shownSpecialties"
              :key="s.id"
              type="button"
              class="rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition"
              :class="chosen.has(s.id) ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand-400'"
              :title="s.description || ''"
              @click="toggleSpecialty(s.id)"
            >{{ chosen.has(s.id) ? '✓ ' : '' }}{{ s.name }}</button>
          </div>
          <p class="mt-3 text-xs text-slate-500">Missing a specialty? Ask MedLink support - the list is managed by the MedLink team. Saved with <b>Save profile</b>.</p>
        </section>
      </div>
      <aside class="space-y-4 lg:sticky lg:top-24 lg:h-fit">
        <div class="card card-pad">
          <p class="text-xs font-bold tracking-wide text-slate-400 uppercase">Verification</p>
          <div class="mt-2"><StatusBadge :status="org.status" /></div>
          <p class="mt-3 text-sm text-slate-500">{{ org.users_count }} team members · {{ org.medicines_count }} listed medicines</p>
        </div>
        <button class="btn btn-primary btn-lg w-full" :disabled="form.processing.value"><AppSpinner v-if="form.processing.value" /> Save profile</button>
      </aside>
    </form>
  </div>
</template>
