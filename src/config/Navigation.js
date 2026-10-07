import {
  ArchiveBoxIcon, ArrowsRightLeftIcon, BuildingOffice2Icon, BuildingStorefrontIcon, ChartBarSquareIcon,
  ClipboardDocumentListIcon, ClockIcon, DocumentPlusIcon, FingerPrintIcon, HomeModernIcon, QueueListIcon,
  ShoppingBagIcon, Squares2X2Icon, UserGroupIcon, UsersIcon, BeakerIcon, CalculatorIcon,
} from '@heroicons/vue/24/outline'

/**
 * Role-based sidebar. An item shows when the user has its permission (`can`) and,
 * if given, belongs to a tenant of `tenantType`. The backend enforces the same rules.
 */
export const navigation = [
  {
    section: 'section.workspace',
    items: [
      { key: 'nav.dashboard', to: { name: 'app.dashboard' }, icon: Squares2X2Icon },
      { key: 'nav.pos', to: { name: 'app.pos' }, icon: CalculatorIcon, can: 'sales.create', tenantType: 'pharmacy' },
      { key: 'nav.orders', to: { name: 'app.orders' }, also: ['app.order'], icon: ShoppingBagIcon, can: 'orders.view', tenantType: 'pharmacy', badge: 'pendingOrders' },
      { key: 'nav.inventory', to: { name: 'app.inventory' }, also: ['app.inventory.item'], icon: ArchiveBoxIcon, can: 'inventory.view', tenantType: 'pharmacy' },
      { key: 'nav.expiry', to: { name: 'app.expiry' }, icon: ClockIcon, can: 'inventory.view', tenantType: 'pharmacy', badge: 'expiring' },
      { key: 'nav.stockMovements', to: { name: 'app.movements' }, icon: ArrowsRightLeftIcon, can: 'inventory.view', tenantType: 'pharmacy' },
      { key: 'nav.patients', to: { name: 'app.patients' }, icon: UsersIcon, can: 'patients.view', tenantType: 'hospital' },
      { key: 'nav.prescriptions', to: { name: 'app.prescriptions' }, also: ['app.prescription'], icon: ClipboardDocumentListIcon, can: 'prescriptions.view', tenantType: 'hospital' },
      { key: 'nav.newPrescription', to: { name: 'app.prescriptions.new' }, icon: DocumentPlusIcon, can: 'prescriptions.create', tenantType: 'hospital' },
    ],
  },
  {
    section: 'section.platform',
    items: [
      { key: 'nav.tenants', to: { name: 'app.admin.tenants' }, icon: BuildingOffice2Icon, can: 'tenants.manage', badge: 'pendingTenants' },
      { key: 'nav.catalog', to: { name: 'app.admin.catalog' }, icon: BeakerIcon, can: 'catalog.manage' },
    ],
  },
  {
    section: 'section.manage',
    items: [
      { key: 'nav.reports', to: { name: 'app.reports' }, icon: ChartBarSquareIcon, can: ['reports.view', 'prescriptions.create'] },
      { key: 'nav.team', to: { name: 'app.team' }, icon: UserGroupIcon, can: 'users.manage' },
      { key: 'nav.activity', to: { name: 'app.activity' }, icon: FingerPrintIcon, can: 'activity.view' },
      { key: 'nav.organization', to: { name: 'app.organization' }, icon: BuildingStorefrontIcon, can: 'organization.manage', tenantType: 'pharmacy' },
      { key: 'nav.organization', to: { name: 'app.organization' }, icon: HomeModernIcon, can: 'organization.manage', tenantType: 'hospital' },
    ],
  },
]

export function visibleNavigation(auth) {
  const allowed = (item) => {
    const perms = Array.isArray(item.can) ? item.can : item.can ? [item.can] : []
    if (perms.length && !perms.some((p) => auth.can(p))) return false
    if (item.tenantType && auth.tenantType !== item.tenantType) return false
    return true
  }
  return navigation
    .map((s) => ({ ...s, items: s.items.filter(allowed) }))
    .filter((s) => s.items.length)
}

export const publicLinks = [
  { key: 'nav.findMedicine', to: { name: 'search' }, icon: QueueListIcon },
  { key: 'nav.pharmacies', to: { name: 'pharmacies' }, icon: BuildingStorefrontIcon },
  { key: 'nav.checkPrescription', to: { name: 'prescription-check' }, icon: ClipboardDocumentListIcon },
]
