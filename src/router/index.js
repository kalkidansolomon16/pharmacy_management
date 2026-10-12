import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import PublicLayout from '@/layouts/PublicLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import HomeView from '@/views/public/HomeView.vue'

const routes = [
  {
    path: '/',
    component: PublicLayout,
    children: [
      { path: '', name: 'home', component: HomeView },
      { path: 'search', name: 'search', component: () => import('@/views/public/SearchView.vue'), meta: { title: 'Find medicine' } },
      { path: 'pharmacies', name: 'pharmacies', component: () => import('@/views/public/PharmaciesView.vue'), meta: { title: 'Pharmacies' } },
      { path: 'pharmacies/nearby', name: 'pharmacies.nearby', component: () => import('@/views/public/NearbyPharmaciesView.vue'), meta: { title: 'Pharmacies & hospitals near you' } },
      { path: 'pharmacies/:slug', name: 'pharmacy', component: () => import('@/views/public/PharmacyDetailView.vue') },
      { path: 'cart', name: 'cart', component: () => import('@/views/public/CartView.vue'), meta: { title: 'Your cart' } },
      { path: 'prescription-check', name: 'prescription-check', component: () => import('@/views/public/PrescriptionCheckView.vue'), meta: { title: 'Check a prescription' } },
      { path: 'account/orders', name: 'account.orders', component: () => import('@/views/account/MyOrdersView.vue'), meta: { auth: true, title: 'My orders' } },
      { path: 'account/orders/:id', name: 'account.order', component: () => import('@/views/account/MyOrderDetailView.vue'), meta: { auth: true, title: 'Order' } },
      { path: 'account/notifications', name: 'account.notifications', component: () => import('@/views/shared/NotificationsView.vue'), meta: { auth: true, title: 'Notifications' } },
      { path: 'account/profile', name: 'account.profile', component: () => import('@/views/shared/ProfileView.vue'), meta: { auth: true, title: 'Profile' } },
    ],
  },
  {
    path: '/',
    component: AuthLayout,
    children: [
      { path: 'login', name: 'login', component: () => import('@/views/auth/LoginView.vue'), meta: { guest: true, title: 'Sign in' } },
      { path: 'register', name: 'register', component: () => import('@/views/auth/RegisterView.vue'), meta: { guest: true, title: 'Create account' } },
      { path: 'register/organization', name: 'register.organization', component: () => import('@/views/auth/RegisterOrganizationView.vue'), meta: { guest: true, title: 'Register your pharmacy or hospital' } },
      { path: 'pending', name: 'pending', component: () => import('@/views/auth/PendingApprovalView.vue'), meta: { auth: true, title: 'Awaiting approval' } },
    ],
  },
  {
    path: '/app',
    component: AppLayout,
    meta: { auth: true, staff: true },
    children: [
      { path: '', redirect: { name: 'app.dashboard' } },
      { path: 'dashboard', name: 'app.dashboard', component: () => import('@/views/app/DashboardView.vue'), meta: { title: 'Dashboard' } },
      // Pharmacy
      { path: 'pos', name: 'app.pos', component: () => import('@/views/app/pharmacy/PosView.vue'), meta: { can: 'sales.create', module: 'pharmacy', title: 'Point of sale' } },
      { path: 'orders', name: 'app.orders', component: () => import('@/views/app/pharmacy/OrdersView.vue'), meta: { can: 'orders.view', module: 'pharmacy', title: 'Orders' } },
      { path: 'orders/:id', name: 'app.order', component: () => import('@/views/app/pharmacy/OrderDetailView.vue'), meta: { can: 'orders.view', module: 'pharmacy', title: 'Order' } },
      { path: 'inventory', name: 'app.inventory', component: () => import('@/views/app/pharmacy/InventoryView.vue'), meta: { can: 'inventory.view', module: 'pharmacy', title: 'Inventory' } },
      { path: 'inventory/expiry', name: 'app.expiry', component: () => import('@/views/app/pharmacy/ExpiryView.vue'), meta: { can: 'inventory.view', module: 'pharmacy', title: 'Expiry tracker' } },
      { path: 'inventory/:id', name: 'app.inventory.item', component: () => import('@/views/app/pharmacy/InventoryItemView.vue'), meta: { can: 'inventory.view', module: 'pharmacy', title: 'Medicine stock' } },
      { path: 'stock-movements', name: 'app.movements', component: () => import('@/views/app/pharmacy/StockMovementsView.vue'), meta: { can: 'inventory.view', module: 'pharmacy', title: 'Stock movements' } },
      // Hospital
      { path: 'patients', name: 'app.patients', component: () => import('@/views/app/hospital/PatientsView.vue'), meta: { can: 'patients.view', module: 'clinical', title: 'Patients' } },
      { path: 'prescriptions', name: 'app.prescriptions', component: () => import('@/views/app/hospital/PrescriptionsView.vue'), meta: { can: 'prescriptions.view', module: 'clinical', title: 'Prescriptions' } },
      { path: 'prescriptions/new', name: 'app.prescriptions.new', component: () => import('@/views/app/hospital/PrescriptionCreateView.vue'), meta: { can: 'prescriptions.create', module: 'clinical', title: 'Write prescription' } },
      { path: 'prescriptions/:id', name: 'app.prescription', component: () => import('@/views/app/hospital/PrescriptionDetailView.vue'), meta: { can: 'prescriptions.view', module: 'clinical', title: 'Prescription' } },
      // Patient journey (reception → triage → doctor → lab → cashier)
      { path: 'queue', name: 'app.queue', component: () => import('@/views/app/clinical/QueueView.vue'), meta: { can: 'visits.view', module: 'clinical', title: 'Patient queue' } },
      { path: 'visits/:id', name: 'app.visit', component: () => import('@/views/app/clinical/VisitView.vue'), meta: { can: 'visits.view', module: 'clinical', title: 'Visit' } },
      { path: 'lab', name: 'app.lab', component: () => import('@/views/app/lab/LabWorklistView.vue'), meta: { can: 'lab.view', module: 'lab', title: 'Laboratory' } },
      { path: 'lab/tests', name: 'app.lab.tests', component: () => import('@/views/app/lab/LabTestsView.vue'), meta: { can: 'lab.view', module: 'lab', title: 'Lab test menu' } },
      // Billing & insurance
      { path: 'cashier', name: 'app.cashier', component: () => import('@/views/app/billing/CashierView.vue'), meta: { can: 'billing.view', module: 'billing', title: 'Cashier & invoices' } },
      { path: 'services', name: 'app.services', component: () => import('@/views/app/billing/ServicesView.vue'), meta: { can: ['billing.view', 'services.create', 'services.update'], module: 'billing', title: 'Service price list' } },
      { path: 'insurance', name: 'app.insurance', component: () => import('@/views/app/insurance/PayersView.vue'), meta: { can: 'insurance.view', module: 'insurance', title: 'Insurance & credit' } },
      { path: 'claims', name: 'app.claims', component: () => import('@/views/app/insurance/ClaimsView.vue'), meta: { can: 'insurance.view', module: 'insurance', title: 'Claims & receivables' } },
      // Supply chain
      { path: 'stores', name: 'app.stores', component: () => import('@/views/app/pharmacy/StoresView.vue'), meta: { can: 'inventory.view', module: 'pharmacy', title: 'Stores & transfers' } },
      { path: 'purchasing', name: 'app.purchasing', component: () => import('@/views/app/pharmacy/PurchasingView.vue'), meta: { can: ['purchasing.view', 'returns.manage'], module: 'pharmacy', title: 'Purchasing' } },
      { path: 'controlled', name: 'app.controlled', component: () => import('@/views/app/pharmacy/ControlledRegisterView.vue'), meta: { can: 'controlled.view', module: 'pharmacy', title: 'Controlled drugs register' } },
      { path: 'rx-inbox', name: 'app.rxinbox', component: () => import('@/views/app/pharmacy/RxInboxView.vue'), meta: { can: 'prescriptions.dispense', module: 'pharmacy', title: 'e-Prescription inbox' } },
      // Owner & organization
      { path: 'owner', name: 'app.owner', component: () => import('@/views/app/owner/OwnerDashboardView.vue'), meta: { can: 'owner.dashboard', title: 'Owner overview' } },
      { path: 'reports/financial', name: 'app.reports.financial', component: () => import('@/views/app/reports/FinancialReportView.vue'), meta: { can: 'reports.view', module: 'billing', title: 'Financial report' } },
      { path: 'reports/dhis2', name: 'app.reports.dhis2', component: () => import('@/views/app/reports/Dhis2ReportView.vue'), meta: { can: 'reports.view', module: 'clinical', title: 'HMIS / DHIS2 report' } },
      { path: 'settings', name: 'app.settings', component: () => import('@/views/app/settings/SettingsView.vue'), meta: { can: 'organization.manage', title: 'Settings' } },
      { path: 'subscription', name: 'app.subscription', component: () => import('@/views/app/settings/SubscriptionView.vue'), meta: { can: 'subscription.view', title: 'Subscription' } },
      { path: 'security', name: 'app.security', component: () => import('@/views/app/settings/SessionsView.vue'), meta: { title: 'Signed-in devices' } },
      { path: 'help', name: 'app.help', component: () => import('@/views/app/HelpView.vue'), meta: { title: 'Help & support' } },
      { path: 'admin/billing', name: 'app.admin.billing', component: () => import('@/views/app/admin/PlatformBillingView.vue'), meta: { can: 'platform.plans', title: 'Plans & subscriptions' } },
      // Platform
      { path: 'admin/tenants', name: 'app.admin.tenants', component: () => import('@/views/app/admin/TenantsView.vue'), meta: { can: 'tenants.manage', title: 'Organizations' } },
      { path: 'catalog', name: 'app.catalog', component: () => import('@/views/app/admin/CatalogView.vue'), meta: { can: ['catalog.contribute', 'catalog.manage'], title: 'Medicine catalogue' } },
      { path: 'admin/catalog', name: 'app.admin.catalog', component: () => import('@/views/app/admin/CatalogView.vue'), meta: { can: 'catalog.manage', title: 'Medicine catalogue' } },
      // Shared
      { path: 'reports', name: 'app.reports', component: () => import('@/views/app/ReportsView.vue'), meta: { can: ['reports.view', 'prescriptions.create'], title: 'Reports' } },
      { path: 'team', name: 'app.team', component: () => import('@/views/app/TeamView.vue'), meta: { can: 'users.view', title: 'Team' } },
      { path: 'roles', name: 'app.roles', component: () => import('@/views/app/RolesView.vue'), meta: { can: 'roles.manage', title: 'Roles & permissions' } },
      { path: 'activity', name: 'app.activity', component: () => import('@/views/app/ActivityLogView.vue'), meta: { can: 'activity.view', title: 'Audit log' } },
      { path: 'organization', name: 'app.organization', component: () => import('@/views/app/OrganizationView.vue'), meta: { can: 'organization.manage', title: 'Organization' } },
      { path: 'notifications', name: 'app.notifications', component: () => import('@/views/shared/NotificationsView.vue'), meta: { title: 'Notifications' } },
      { path: 'profile', name: 'app.profile', component: () => import('@/views/shared/ProfileView.vue'), meta: { title: 'Profile' } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { title: 'Not found' } },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (to, from, saved) => saved ?? (to.hash ? { el: to.hash, behavior: 'smooth' } : { top: 0 }),
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loaded) await auth.fetchMe()

  if (to.meta.guest && auth.isAuthenticated) return auth.homeRoute
  if (to.matched.some((r) => r.meta.auth) && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  const staffArea = to.matched.some((r) => r.meta.staff)
  if (staffArea) {
    if (auth.isCustomer) return { name: 'account.orders' }
    if (!auth.tenantActive) return { name: 'pending' }
  }

  const needs = to.meta.can ? (Array.isArray(to.meta.can) ? to.meta.can : [to.meta.can]) : []
  if (needs.length && !needs.some((p) => auth.can(p))) return { name: 'app.dashboard' }
  if (to.meta.tenantType && auth.tenantType !== to.meta.tenantType) return { name: 'app.dashboard' }
  if (to.meta.module && !auth.hasModule(to.meta.module)) return { name: 'app.dashboard' }

  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · MedLink Ethiopia` : 'MedLink Ethiopia · መድኃኒትዎን በቅርብ ያግኙ'
})

export default router
