<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRightIcon, BellAlertIcon, BuildingStorefrontIcon, ChartBarIcon, CheckBadgeIcon, ClipboardDocumentCheckIcon,
  DevicePhoneMobileIcon, MagnifyingGlassIcon, MapPinIcon, QrCodeIcon, ShieldCheckIcon, ShoppingBagIcon, TruckIcon,
} from '@heroicons/vue/24/outline'
import { CheckCircleIcon, SparklesIcon } from '@heroicons/vue/24/solid'
import api from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { useMetaStore } from '@/stores/meta'
import { compactNumber, money } from '@/lib/format'
import CategoryIcon from '@/components/ui/CategoryIcon.vue'
import PharmacyCard from '@/components/public/PharmacyCard.vue'

const router = useRouter()
const meta = useMetaStore()
const { t, locale } = useI18n()

const q = ref('')
const city = ref('')
const stats = ref(null)
const pharmacies = ref([])

const popular = ['Paracetamol', 'Amoxicillin', 'Coartem', 'ORS', 'Metformin', 'Vitamin C', 'Salbutamol']

const categoriesFailed = ref(false)
function loadCategories() {
  categoriesFailed.value = false
  meta.load().catch(() => (categoriesFailed.value = true))
}

onMounted(async () => {
  loadCategories()
  const [s, p] = await Promise.allSettled([api.get('/public/stats'), api.get('/public/pharmacies', { params: { per_page: 6 } })])
  if (s.status === 'fulfilled') stats.value = s.value.data.data
  if (p.status === 'fulfilled') pharmacies.value = p.value.data.data
})

function search(term = q.value) {
  router.push({ name: 'search', query: { q: term || undefined, city: city.value || undefined } })
}

const statItems = computed(() => [
  { label: 'Verified pharmacies', value: stats.value?.pharmacies ?? '—' },
  { label: 'Medicines in catalogue', value: stats.value?.medicines ?? '—' },
  { label: 'Cities covered', value: stats.value?.cities ?? '—' },
  { label: 'Orders fulfilled', value: stats.value ? compactNumber(stats.value.orders_completed) : '—' },
])

const steps = [
  { icon: MagnifyingGlassIcon, title: 'Search & compare', am: 'ይፈልጉና ያወዳድሩ', text: 'See which nearby pharmacies have your medicine in stock today, and what it costs in Birr.' },
  { icon: ClipboardDocumentCheckIcon, title: 'Reserve with your prescription', am: 'በማዘዣዎ ያስይዙ', text: 'Enter the code your doctor gave you. We check it is valid and how much you may still collect.' },
  { icon: ShoppingBagIcon, title: 'Pick up or get it delivered', am: 'ይውሰዱ ወይም ይላክልዎ', text: 'Pay with cash, telebirr, CBE Birr or your health insurance when you collect.' },
]

const payments = ['telebirr', 'CBE Birr', 'Chapa', 'Cash', 'CBHI insurance', 'Bank transfer']
</script>

<template>
  <div>
    <!-- HERO -->
    <section class="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <div class="pattern-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div class="absolute -top-40 -left-40 size-[32rem] rounded-full bg-brand-200/40 blur-3xl" />
      <div class="absolute top-20 -right-32 size-[28rem] rounded-full bg-gold-300/20 blur-3xl" />

      <div class="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-28">
        <div class="animate-fade-up">
          <span class="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-bold text-brand-800 shadow-sm backdrop-blur">
            <CheckBadgeIcon class="size-4 text-brand-600" /> {{ t('hero.badge') }}
          </span>
          <h1 class="mt-6 text-4xl leading-[1.08] font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.6rem]" :class="locale === 'am' && 'font-am leading-[1.25]'">
            {{ t('hero.title1') }}
            <span class="bg-gradient-to-r from-brand-600 via-brand-500 to-gold-500 bg-clip-text text-transparent">{{ t('hero.title2') }}</span>
          </h1>
          <p class="mt-5 max-w-xl text-lg leading-relaxed text-slate-600" :class="locale === 'am' && 'font-am'">{{ t('hero.subtitle') }}</p>

          <form class="mt-8 rounded-3xl border border-slate-200/80 bg-white p-2 shadow-xl shadow-brand-900/10" @submit.prevent="search()">
            <div class="flex flex-col gap-2 sm:flex-row">
              <label class="relative flex-1">
                <MagnifyingGlassIcon class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-brand-600" />
                <input v-model="q" type="search" class="h-14 w-full rounded-2xl border-0 bg-transparent pr-4 pl-12 text-base text-slate-900 placeholder:text-slate-400 focus:ring-0 focus:outline-none" :placeholder="t('hero.searchPlaceholder')" />
              </label>
              <label class="relative sm:w-48">
                <MapPinIcon class="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
                <select v-model="city" class="h-14 w-full appearance-none rounded-2xl border-0 bg-slate-50 pr-4 pl-10 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-brand-500/30 focus:outline-none">
                  <option value="">{{ t('hero.anyCity') }}</option>
                  <option v-for="c in meta.citiesWithPharmacies" :key="c" :value="c">{{ c }}</option>
                </select>
              </label>
              <button type="submit" class="btn btn-primary btn-lg h-14 px-7">{{ t('hero.search') }} <ArrowRightIcon class="size-5" /></button>
            </div>
          </form>

          <div class="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span class="font-semibold text-slate-500">{{ t('hero.popular') }}</span>
            <button v-for="p in popular" :key="p" class="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700" @click="search(p)">
              {{ p }}
            </button>
          </div>

          <dl class="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div v-for="s in statItems" :key="s.label">
              <dt class="text-xs font-semibold text-slate-500">{{ s.label }}</dt>
              <dd class="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{{ s.value }}</dd>
            </div>
          </dl>
        </div>

        <!-- Hero visual -->
        <div class="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div class="absolute inset-6 -rotate-3 rounded-[2.5rem] bg-gradient-to-br from-brand-500 to-brand-800" />
          <div class="relative overflow-hidden rounded-[2.5rem] border-[6px] border-white shadow-2xl shadow-brand-900/25">
            <img src="/images/759def1fd634439abaf52bdcf74a723a.jpg" alt="An Ethiopian elder in a traditional gabi discussing his medicine with a young pharmacist" class="aspect-[4/4.4] w-full object-cover" />
            <div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-brand-950/60 to-transparent" />
            <div class="tibeb absolute right-0 bottom-0 left-0 h-3" />
          </div>

          <!-- floating cards -->
          <div class="glass absolute top-8 -left-4 w-60 animate-float rounded-2xl p-4 shadow-xl sm:-left-10">
            <div class="flex items-center gap-3">
              <span class="grid size-10 place-items-center rounded-xl bg-brand-600 text-white"><SparklesIcon class="size-5" /></span>
              <div>
                <p class="text-xs font-semibold text-slate-500">Coartem 20/120mg</p>
                <p class="text-sm font-extrabold text-slate-900">from {{ money(12) }}</p>
              </div>
            </div>
            <p class="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-700"><MapPinIcon class="size-3.5" /> In stock at 3 pharmacies near Bole</p>
          </div>

          <div class="glass absolute -right-2 bottom-20 w-56 animate-float rounded-2xl p-4 shadow-xl [animation-delay:1.5s] sm:-right-8">
            <p class="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircleIcon class="size-4" /> Prescription verified</p>
            <p class="mt-1 font-mono text-sm font-bold tracking-wider text-slate-900">RX-7KD9-3PQ2</p>
            <p class="mt-1 text-xs text-slate-500">Entoto Hills General Hospital</p>
          </div>

          <div class="absolute -bottom-6 left-10 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl">
            <DevicePhoneMobileIcon class="size-5 text-gold-400" />
            <span class="text-sm font-semibold">Pay with telebirr</span>
          </div>
        </div>
      </div>
    </section>

    <!-- CATEGORIES -->
    <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p class="text-xs font-bold tracking-[0.16em] text-brand-600 uppercase">Browse by need</p>
          <h2 class="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Shop by category</h2>
        </div>
        <RouterLink :to="{ name: 'search' }" class="btn btn-secondary">All medicines <ArrowRightIcon class="size-4" /></RouterLink>
      </div>
      <div class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <RouterLink
          v-for="(c, i) in meta.categories.slice(0, 10)"
          :key="c.id"
          :to="{ name: 'search', query: { category: c.slug } }"
          class="card card-hover group flex items-center gap-3 p-4"
          :style="{ animationDelay: i * 40 + 'ms' }"
        >
          <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
            <CategoryIcon :icon="c.icon" class="size-5.5" />
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-bold text-slate-800">{{ c.name }}</span>
            <span class="block truncate font-am text-xs text-slate-400">{{ c.name_am }}</span>
          </span>
        </RouterLink>
        <div v-if="categoriesFailed" class="col-span-full flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
          Categories couldn't be loaded. Please check your connection and try again.
          <button class="btn btn-secondary btn-sm" @click="loadCategories">Retry</button>
        </div>
        <template v-else-if="!meta.categories.length">
          <div v-for="i in 10" :key="i" class="skeleton h-[4.75rem] rounded-2xl" />
        </template>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="relative overflow-hidden bg-brand-950 py-20 text-white">
      <div class="pattern-dots absolute inset-0" />
      <div class="absolute -right-40 -bottom-40 size-[30rem] rounded-full bg-brand-500/20 blur-3xl" />
      <div class="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div class="mx-auto max-w-2xl text-center">
          <p class="font-am text-gold-300">እንዴት ይሠራል?</p>
          <h2 class="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Your medicine in three simple steps</h2>
          <p class="mt-3 text-brand-200/80">No more walking from pharmacy to pharmacy asking “ይህ መድኃኒት አለ?”</p>
        </div>
        <ol class="mt-14 grid gap-6 md:grid-cols-3">
          <li v-for="(s, i) in steps" :key="s.title" class="relative rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur transition hover:bg-white/[0.07]">
            <span class="absolute top-6 right-6 text-5xl font-extrabold text-white/5">0{{ i + 1 }}</span>
            <span class="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 text-brand-950 shadow-lg shadow-gold-500/20"><component :is="s.icon" class="size-6" /></span>
            <h3 class="mt-5 text-lg font-bold">{{ s.title }}</h3>
            <p class="font-am text-sm text-gold-300/80">{{ s.am }}</p>
            <p class="mt-3 text-sm leading-relaxed text-brand-100/75">{{ s.text }}</p>
          </li>
        </ol>
        <div class="mt-12 flex flex-wrap items-center justify-center gap-3">
          <span class="text-sm text-brand-200/70">Pay your way:</span>
          <span v-for="p in payments" :key="p" class="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-semibold">{{ p }}</span>
        </div>
      </div>
    </section>

    <!-- PHARMACIES -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p class="text-xs font-bold tracking-[0.16em] text-brand-600 uppercase">Trusted partners</p>
          <h2 class="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Pharmacies on MedLink</h2>
          <p class="mt-2 text-slate-500">Every pharmacy is verified against its EFDA licence before going live.</p>
        </div>
        <RouterLink :to="{ name: 'pharmacies' }" class="btn btn-secondary">View directory <ArrowRightIcon class="size-4" /></RouterLink>
      </div>
      <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <PharmacyCard v-for="p in pharmacies" :key="p.id" :pharmacy="p" />
        <template v-if="!pharmacies.length">
          <div v-for="i in 3" :key="i" class="skeleton h-64 rounded-2xl" />
        </template>
      </div>
    </section>

    <!-- FOR PROVIDERS -->
    <section class="bg-gradient-to-b from-white to-brand-50/60 py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6">
        <div class="mx-auto max-w-2xl text-center">
          <p class="text-xs font-bold tracking-[0.16em] text-brand-600 uppercase">{{ t('nav.forBusiness') }}</p>
          <h2 class="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Run your pharmacy or hospital on MedLink</h2>
        </div>
        <div class="mt-12 grid gap-6 lg:grid-cols-2">
          <article class="card overflow-hidden">
            <div class="relative h-52">
              <img src="/images/istockphoto-1471839731-612x612.jpg" alt="Pharmacist checking a medicine box on the shelf" class="size-full object-cover" />
              <div class="absolute inset-0 bg-gradient-to-t from-brand-950/80 to-transparent" />
              <h3 class="absolute bottom-4 left-6 flex items-center gap-2 text-xl font-extrabold text-white"><BuildingStorefrontIcon class="size-6 text-gold-400" /> For pharmacies</h3>
            </div>
            <ul class="grid gap-4 p-6 sm:grid-cols-2">
              <li v-for="f in [
                { i: ShieldCheckIcon, t: 'FEFO stock control', d: 'Batches are dispensed first-expiry-first-out. Expired stock can never be sold.' },
                { i: BellAlertIcon, t: 'Expiry & low-stock alerts', d: 'A 06:00 daily scan flags what expires within 90 days and what to reorder.' },
                { i: ShoppingBagIcon, t: 'Online orders + POS', d: 'Serve walk-in customers and online reservations from one screen.' },
                { i: ChartBarIcon, t: 'Sales & margin reports', d: 'Daily sales, top medicines, payment mix. Export to Excel or PDF.' },
              ]" :key="f.t" class="flex gap-3">
                <component :is="f.i" class="mt-0.5 size-5 shrink-0 text-brand-600" />
                <span><b class="block text-sm text-slate-900">{{ f.t }}</b><span class="text-sm text-slate-500">{{ f.d }}</span></span>
              </li>
            </ul>
            <div class="px-6 pb-6">
              <RouterLink :to="{ name: 'register.organization', query: { type: 'pharmacy' } }" class="btn btn-primary w-full sm:w-auto">Register your pharmacy <ArrowRightIcon class="size-4" /></RouterLink>
            </div>
          </article>

          <article class="card overflow-hidden">
            <div class="relative h-52">
              <img src="/images/gettyimages-1424868032-612x612.jpg" alt="Doctor with a stethoscope" class="size-full object-cover" />
              <div class="absolute inset-0 bg-gradient-to-t from-brand-950/80 to-transparent" />
              <h3 class="absolute bottom-4 left-6 flex items-center gap-2 text-xl font-extrabold text-white"><ClipboardDocumentCheckIcon class="size-6 text-gold-400" /> For hospitals & clinics</h3>
            </div>
            <ul class="grid gap-4 p-6 sm:grid-cols-2">
              <li v-for="f in [
                { i: QrCodeIcon, t: 'Digital prescriptions', d: 'Each prescription gets a unique code and QR, valid at any MedLink pharmacy.' },
                { i: ShieldCheckIcon, t: 'Quantity enforced', d: 'Patients can never collect more than prescribed - even across pharmacies.' },
                { i: TruckIcon, t: 'Patients find stock', d: 'Patients see which pharmacies have every item on their prescription.' },
                { i: ChartBarIcon, t: 'Prescribing insights', d: 'Prescriptions per doctor, dispense rates and most-prescribed medicines.' },
              ]" :key="f.t" class="flex gap-3">
                <component :is="f.i" class="mt-0.5 size-5 shrink-0 text-brand-600" />
                <span><b class="block text-sm text-slate-900">{{ f.t }}</b><span class="text-sm text-slate-500">{{ f.d }}</span></span>
              </li>
            </ul>
            <div class="px-6 pb-6">
              <RouterLink :to="{ name: 'register.organization', query: { type: 'hospital' } }" class="btn btn-secondary w-full sm:w-auto">Register your hospital <ArrowRightIcon class="size-4" /></RouterLink>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- PRESCRIPTION CTA -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div class="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 px-6 py-12 text-white shadow-2xl shadow-brand-900/30 sm:px-12">
        <img src="/images/medicine-pictures-kki0avidxad314fw.jpg" alt="" class="absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover opacity-25 [mask-image:linear-gradient(to_left,black,transparent)] md:block" />
        <div class="pattern-dots absolute inset-0" />
        <div class="relative max-w-xl">
          <p class="font-am text-gold-300">የሐኪም ማዘዣ አለዎት?</p>
          <h2 class="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Got a prescription code from your doctor?</h2>
          <p class="mt-3 text-brand-100/80">Check what's on it, how much you can still collect, and which pharmacies have everything in stock right now.</p>
          <div class="mt-7 flex flex-wrap gap-3">
            <RouterLink :to="{ name: 'prescription-check' }" class="btn btn-gold btn-lg">Check my prescription <ArrowRightIcon class="size-5" /></RouterLink>
            <RouterLink :to="{ name: 'search' }" class="btn btn-lg border border-white/25 text-white hover:bg-white/10">Search medicines</RouterLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
