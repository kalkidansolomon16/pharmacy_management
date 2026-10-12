import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api, { tokenStorage } from '@/lib/api'
import { setLocale } from '@/lib/i18n'

export const ROLE_LABELS = {
  super_admin: 'Platform admin',
  pharmacy_admin: 'Pharmacy admin',
  staff: 'Pharmacist',
  hospital_admin: 'Hospital admin',
  doctor: 'Doctor',
  customer: 'Customer',
  nurse: 'Nurse',
  receptionist: 'Receptionist',
  lab_technician: 'Lab technician',
  cashier: 'Cashier',
  owner: 'Owner',
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(tokenStorage.get())
  const loaded = ref(false)
  /** Set when the API reports the organization is pending / suspended. */
  const blockedReason = ref(null)

  const isAuthenticated = computed(() => !!user.value)
  const role = computed(() => user.value?.role ?? null)
  const permissions = computed(() => new Set(user.value?.permissions ?? []))
  const tenant = computed(() => user.value?.tenant ?? null)
  const tenantType = computed(() => tenant.value?.type ?? null)
  const isSuperAdmin = computed(() => role.value === 'super_admin')
  const isCustomer = computed(() => role.value === 'customer')
  const isStaffUser = computed(() => !!user.value && !isCustomer.value)
  const tenantActive = computed(() => !tenant.value || tenant.value.status === 'active')
  // Built-in role labels live here; custom roles carry their own label from the server
  const roleLabel = computed(() => ROLE_LABELS[role.value] ?? user.value?.role_label ?? '')
  /** Modules switched on for the organization (pharmacy, clinical, lab, billing, insurance). */
  const modules = computed(() => new Set(user.value?.modules ?? []))
  const subscription = computed(() => user.value?.subscription ?? null)

  const can = (permission) => permissions.value.has(permission)
  const hasRole = (...roles) => roles.includes(role.value)
  /** True when the user holds at least one of the permissions. */
  const canAny = (...perms) => perms.some((p) => permissions.value.has(p))
  const hasModule = (module) => modules.value.has(module)

  /** Where a user lands after signing in. */
  const homeRoute = computed(() => {
    if (!user.value) return { name: 'home' }
    if (!tenantActive.value) return { name: 'pending' }
    return isCustomer.value ? { name: 'account.orders' } : { name: 'app.dashboard' }
  })

  function setSession(data) {
    token.value = data.token
    tokenStorage.set(data.token)
    setUser(data.user)
  }

  function setUser(value) {
    user.value = value
    blockedReason.value = value?.tenant && value.tenant.status !== 'active' ? `tenant_${value.tenant.status}` : null
    if (value?.locale) setLocale(value.locale)
  }

  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials)
    setSession(data.data)
    return data
  }

  async function register(payload) {
    const { data } = await api.post('/auth/register', payload)
    setSession(data.data)
    return data
  }

  async function registerOrganization(payload) {
    const { data } = await api.post('/auth/register-organization', payload)
    setSession(data.data)
    return data
  }

  async function fetchMe() {
    if (!tokenStorage.get()) {
      loaded.value = true
      return null
    }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.data)
    } catch (error) {
      if (error.status === 401) clear()
    } finally {
      loaded.value = true
    }
    return user.value
  }

  async function updateProfile(payload) {
    const { data } = await api.put('/auth/profile', payload)
    setUser(data.data)
    return data
  }

  async function logout() {
    try {
      if (tokenStorage.get()) await api.post('/auth/logout')
    } catch {
      /* token already invalid */
    } finally {
      clear()
    }
  }

  function clear() {
    user.value = null
    token.value = null
    blockedReason.value = null
    tokenStorage.clear()
  }

  return {
    user, token, loaded, blockedReason,
    isAuthenticated, role, roleLabel, permissions, tenant, tenantType, isSuperAdmin, isCustomer, isStaffUser, tenantActive, homeRoute,
    modules, subscription, hasModule,
    can, canAny, hasRole, login, register, registerOrganization, fetchMe, updateProfile, logout, clear, setUser,
  }
})
