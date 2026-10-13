import {
  ArchiveBoxIcon, ArrowsRightLeftIcon, BuildingOffice2Icon, BuildingStorefrontIcon, ChartBarSquareIcon,
  ClipboardDocumentListIcon, ClockIcon, DocumentPlusIcon, FingerPrintIcon, HomeModernIcon, QueueListIcon,
  CalendarDaysIcon, HeartIcon, ShoppingBagIcon, Squares2X2Icon, UserGroupIcon, UsersIcon, BeakerIcon, CalculatorIcon,
  BanknotesIcon, BuildingLibraryIcon, ClipboardDocumentCheckIcon, CogIcon, CreditCardIcon, DocumentChartBarIcon,
  InboxArrowDownIcon, LifebuoyIcon, LockClosedIcon, PresentationChartLineIcon, ReceiptPercentIcon,
  ShieldCheckIcon, TagIcon, TruckIcon, UserPlusIcon, MapPinIcon, KeyIcon,
} from '@heroicons/vue/24/outline'

/**
 * Role-based sidebar. An item shows when the user has its permission (`can`), the organization has the
 * item's `module` switched on and, if given, the tenant is of `tenantType`. The backend enforces the same rules.
 */
export const navigation = [
  {
    section: 'section.workspace',
    items: [
      { key: 'nav.dashboard', to: { name: 'app.dashboard' }, icon: Squares2X2Icon },
      { key: 'nav.owner', to: { name: 'app.owner' }, icon: PresentationChartLineIcon, can: 'owner.dashboard' },
      { key: 'nav.pos', to: { name: 'app.pos' }, icon: CalculatorIcon, can: 'sales.create', module: 'pharmacy' },
      { key: 'nav.orders', to: { name: 'app.orders' }, also: ['app.order'], icon: ShoppingBagIcon, can: 'orders.view', module: 'pharmacy', badge: 'pendingOrders' },
      { key: 'nav.rxInbox', to: { name: 'app.rxinbox' }, icon: InboxArrowDownIcon, can: 'prescriptions.dispense', module: 'pharmacy', badge: 'rxInbox' },
      { key: 'nav.queue', to: { name: 'app.queue' }, also: ['app.visit'], icon: UserPlusIcon, can: 'visits.view', module: 'clinical', badge: 'waiting' },
      { key: 'nav.appointments', to: { name: 'app.appointments' }, icon: CalendarDaysIcon, can: 'visits.view', module: 'clinical' },
      { key: 'nav.patients', to: { name: 'app.patients' }, icon: UsersIcon, can: 'patients.view', module: 'clinical' },
      { key: 'nav.prescriptions', to: { name: 'app.prescriptions' }, also: ['app.prescription'], icon: ClipboardDocumentListIcon, can: 'prescriptions.view', module: 'clinical' },
      { key: 'nav.newPrescription', to: { name: 'app.prescriptions.new' }, icon: DocumentPlusIcon, can: 'prescriptions.create', module: 'clinical' },
      { key: 'nav.lab', to: { name: 'app.lab' }, icon: BeakerIcon, can: 'lab.view', module: 'lab', badge: 'labOpen' },
    ],
  },
  {
    section: 'section.billing',
    items: [
      { key: 'nav.cashier', to: { name: 'app.cashier' }, icon: BanknotesIcon, can: 'billing.view', module: 'billing', badge: 'unpaid' },
      { key: 'nav.insurance', to: { name: 'app.insurance' }, icon: ShieldCheckIcon, can: 'insurance.view', module: 'insurance' },
      { key: 'nav.claims', to: { name: 'app.claims' }, icon: ReceiptPercentIcon, can: 'insurance.view', module: 'insurance', badge: 'approvals' },
      { key: 'nav.services', to: { name: 'app.services' }, icon: TagIcon, can: ['services.create', 'services.update'], module: 'billing' },
    ],
  },
  {
    section: 'section.stock',
    items: [
      { key: 'nav.inventory', to: { name: 'app.inventory' }, also: ['app.inventory.item'], icon: ArchiveBoxIcon, can: 'inventory.view', module: 'pharmacy' },
      { key: 'nav.expiry', to: { name: 'app.expiry' }, icon: ClockIcon, can: 'inventory.view', module: 'pharmacy', badge: 'expiring' },
      { key: 'nav.purchasing', to: { name: 'app.purchasing' }, icon: TruckIcon, can: ['purchasing.view', 'returns.manage'], module: 'pharmacy' },
      { key: 'nav.stores', to: { name: 'app.stores' }, icon: BuildingLibraryIcon, can: 'inventory.view', module: 'pharmacy' },
      { key: 'nav.controlled', to: { name: 'app.controlled' }, icon: LockClosedIcon, can: 'controlled.view', module: 'pharmacy' },
      { key: 'nav.stockMovements', to: { name: 'app.movements' }, icon: ArrowsRightLeftIcon, can: 'inventory.view', module: 'pharmacy' },
      { key: 'nav.catalog', to: { name: 'app.catalog' }, icon: BeakerIcon, can: 'catalog.contribute', module: 'pharmacy' },
      { key: 'nav.labTests', to: { name: 'app.lab.tests' }, icon: ClipboardDocumentCheckIcon, can: 'lab.manage', module: 'lab' },
    ],
  },
  {
    section: 'section.platform',
    items: [
      { key: 'nav.tenants', to: { name: 'app.admin.tenants' }, icon: BuildingOffice2Icon, can: 'tenants.manage', badge: 'pendingTenants' },
      { key: 'nav.allPatients', to: { name: 'app.admin.patients' }, icon: UsersIcon, can: 'tenants.manage' },
      { key: 'nav.catalog', to: { name: 'app.admin.catalog' }, icon: BeakerIcon, can: 'catalog.manage' },
      { key: 'nav.specialties', to: { name: 'app.admin.specialties' }, icon: HeartIcon, can: 'tenants.manage' },
      { key: 'nav.platformBilling', to: { name: 'app.admin.billing' }, icon: CreditCardIcon, can: 'platform.plans' },
    ],
  },
  {
    section: 'section.manage',
    items: [
      { key: 'nav.reports', to: { name: 'app.reports' }, icon: ChartBarSquareIcon, can: ['reports.view', 'prescriptions.create'] },
      { key: 'nav.financial', to: { name: 'app.reports.financial' }, icon: DocumentChartBarIcon, can: 'billing.view', module: 'billing' },
      { key: 'nav.dhis2', to: { name: 'app.reports.dhis2' }, icon: DocumentChartBarIcon, can: 'reports.view', module: 'clinical' },
      { key: 'nav.team', to: { name: 'app.team' }, icon: UserGroupIcon, can: 'users.view' },
      { key: 'nav.roles', to: { name: 'app.roles' }, icon: KeyIcon, can: 'roles.manage' },
      { key: 'nav.activity', to: { name: 'app.activity' }, icon: FingerPrintIcon, can: 'activity.view' },
      { key: 'nav.organization', to: { name: 'app.organization' }, icon: BuildingStorefrontIcon, can: 'organization.manage', tenantType: 'pharmacy' },
      { key: 'nav.organization', to: { name: 'app.organization' }, icon: HomeModernIcon, can: 'organization.manage', tenantType: 'hospital' },
      { key: 'nav.settings', to: { name: 'app.settings' }, icon: CogIcon, can: 'organization.manage' },
      { key: 'nav.subscription', to: { name: 'app.subscription' }, icon: CreditCardIcon, can: 'subscription.view' },
      { key: 'nav.help', to: { name: 'app.help' }, icon: LifebuoyIcon },
    ],
  },
]

export function visibleNavigation(auth) {
  const allowed = (item) => {
    const perms = Array.isArray(item.can) ? item.can : item.can ? [item.can] : []
    if (perms.length && !perms.some((p) => auth.can(p))) return false
    if (item.tenantType && auth.tenantType !== item.tenantType) return false
    if (item.module && !auth.hasModule(item.module)) return false
    return true
  }
  return navigation
    .map((s) => ({ ...s, items: s.items.filter(allowed) }))
    .filter((s) => s.items.length)
}

export const publicLinks = [
  { key: 'nav.findMedicine', to: { name: 'search' }, icon: QueueListIcon },
  { key: 'nav.pharmacies', to: { name: 'pharmacies' }, icon: BuildingStorefrontIcon },
  { key: 'nav.nearMe', to: { name: 'pharmacies.nearby' }, icon: MapPinIcon },
  { key: 'nav.checkPrescription', to: { name: 'prescription-check' }, icon: ClipboardDocumentListIcon },
]
