<script setup>
/**
 * Roles & permissions.
 * Platform team: edits the default permissions of the built-in roles (apply to every organization).
 * Organization admins: see the built-in roles (read-only) and design custom roles for their own staff.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowPathIcon, KeyIcon, LockClosedIcon, PlusIcon, TrashIcon, UsersIcon } from '@heroicons/vue/24/outline'
import api from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const ui = useUiStore()
const isPlatform = computed(() => auth.isSuperAdmin)

const data = ref(null)
const selectedId = ref(null)
const draft = reactive({ label: '', description: '', permissions: new Set() })
const saving = ref(false)

async function load(keepId = selectedId.value) {
  data.value = (await api.get('/roles')).data.data
  selectedId.value = data.value.roles.some((r) => r.id === keepId) ? keepId : data.value.roles[0]?.id ?? null
}
onMounted(load)

const role = computed(() => data.value?.roles.find((r) => r.id === selectedId.value) ?? null)
const grantable = computed(() => new Set(data.value?.grantable ?? []))
watch(role, (r) => {
  if (!r) return
  Object.assign(draft, { label: r.label, description: r.description ?? '', permissions: new Set(r.permissions) })
}, { immediate: true })

const dirty = computed(() => {
  const r = role.value
  if (!r) return false
  const before = new Set(r.permissions)
  return draft.label !== r.label || (draft.description ?? '') !== (r.description ?? '') || before.size !== draft.permissions.size || [...draft.permissions].some((p) => !before.has(p))
})

const ACTIONS = {
  view: ['View', 'bg-sky-50 text-sky-700 ring-sky-600/15'],
  create: ['Create', 'bg-emerald-50 text-emerald-700 ring-emerald-600/15'],
  update: ['Edit', 'bg-amber-50 text-amber-800 ring-amber-600/20'],
  delete: ['Delete', 'bg-rose-50 text-rose-700 ring-rose-600/15'],
  other: ['Action', 'bg-violet-50 text-violet-700 ring-violet-600/15'],
}
const isLocked = (p) => role.value?.locked.includes(p)
const canToggle = (p) => role.value?.editable && !isLocked(p) && grantable.value.has(p)
function toggle(p) {
  if (!canToggle(p)) return
  const next = new Set(draft.permissions)
  next.has(p) ? next.delete(p) : next.add(p)
  draft.permissions = next
}
function toggleGroup(group, on) {
  const next = new Set(draft.permissions)
  for (const p of group.permissions) if (canToggle(p.name)) on ? next.add(p.name) : next.delete(p.name)
  draft.permissions = next
}
const groupState = (group) => {
  const n = group.permissions.filter((p) => draft.permissions.has(p.name)).length
  return n === 0 ? 'none' : n === group.permissions.length ? 'all' : 'some'
}
// Only show the menu areas this role's editor can actually use
const groups = computed(() => (data.value?.catalog ?? []).filter((g) => {
  if (!role.value) return false
  if (isPlatform.value) return role.value.name === 'super_admin' ? g.scope === 'platform' || ['team', 'reports', 'activity'].includes(g.key) : g.scope === 'organization'
  return true
}))
const countIn = (group) => group.permissions.filter((p) => draft.permissions.has(p.name)).length

async function save() {
  saving.value = true
  try {
    const { data: res } = await api.put(`/roles/${role.value.id}`, { label: draft.label, description: draft.description || null, permissions: [...draft.permissions] })
    ui.success(res.message)
    await load(role.value.id)
    auth.fetchMe() // the sidebar follows the new permissions
  } catch (e) {
    ui.error(Object.values(e.errors ?? {})[0] ?? e.message)
  } finally {
    saving.value = false
  }
}
function resetToDefaults() {
  if (role.value?.defaults) draft.permissions = new Set([...role.value.defaults, ...role.value.locked])
}
async function remove() {
  if (!(await ui.confirm({ title: `Delete “${role.value.label}”?`, message: 'Only possible when nobody has this role.', confirmText: 'Delete role', danger: true }))) return
  try {
    ui.success((await api.delete(`/roles/${role.value.id}`)).data.message)
    await load(null)
  } catch (e) {
    ui.error(Object.values(e.errors ?? {})[0] ?? e.message)
  }
}

// New custom role (organization admins)
const creating = ref(false)
const newRole = reactive({ label: '', description: '', from: '', busy: false, error: '' })
function openCreate(from = '') {
  Object.assign(newRole, { label: '', description: '', from, busy: false, error: '' })
  creating.value = true
}
async function create() {
  newRole.busy = true
  newRole.error = ''
  // Starting from an existing role copies only what this admin is allowed to give
  const base = data.value.roles.find((r) => r.id === Number(newRole.from))
  const permissions = base ? base.permissions.filter((p) => grantable.value.has(p)) : []
  try {
    const { data: res } = await api.post('/roles', { label: newRole.label, description: newRole.description || null, permissions })
    ui.success(res.message)
    creating.value = false
    await load(res.data.id)
  } catch (e) {
    newRole.error = Object.values(e.errors ?? {})[0] ?? e.message
  } finally {
    newRole.busy = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Roles & permissions"
      :eyebrow="isPlatform ? 'Platform' : auth.tenant?.name"
      :subtitle="isPlatform
        ? 'Default permissions of the built-in roles. Changes apply to every pharmacy and hospital that uses the role.'
        : 'Decide what each person can see and do. Built-in roles are set by MedLink; create your own roles for anything else.'"
    >
      <button v-if="!isPlatform" class="btn btn-primary" @click="openCreate()"><PlusIcon class="size-4" /> New role</button>
    </PageHeader>

    <div v-if="!data" class="skeleton h-96 rounded-2xl" />

    <div v-else class="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <!-- Roles -->
      <aside class="card h-fit overflow-hidden">
        <template v-for="section in [{ title: 'Built-in roles', custom: false }, { title: 'Your custom roles', custom: true }]" :key="section.title">
          <p v-if="data.roles.some((r) => r.is_custom === section.custom) || (section.custom && !isPlatform)" class="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{{ section.title }}</p>
          <button
            v-for="r in data.roles.filter((x) => x.is_custom === section.custom)"
            :key="r.id"
            class="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-0"
            :class="r.id === selectedId ? 'bg-brand-50' : 'hover:bg-slate-50'"
            @click="selectedId = r.id"
          >
            <span class="grid size-9 shrink-0 place-items-center rounded-xl" :class="r.is_custom ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'"><KeyIcon class="size-4.5" /></span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900">{{ r.label }} <LockClosedIcon v-if="!r.editable" class="size-3.5 shrink-0 text-slate-400" /></span>
              <span class="text-xs text-slate-500">{{ r.permissions.length }} permissions · {{ r.users_count }} {{ r.users_count === 1 ? 'person' : 'people' }}</span>
            </span>
          </button>
          <p v-if="section.custom && !isPlatform && !data.roles.some((r) => r.is_custom)" class="px-4 py-4 text-sm text-slate-500">None yet. Use <b>New role</b>, e.g. “Store keeper” or “Night-shift pharmacist”.</p>
        </template>
      </aside>

      <!-- Editor -->
      <section v-if="role" class="space-y-4">
        <div class="card card-pad">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <template v-if="role.is_custom && role.editable">
                <div class="grid gap-3 sm:grid-cols-2">
                  <FormField label="Role name"><input id="role-label" v-model="draft.label" class="input" maxlength="60" /></FormField>
                  <FormField label="Description (optional)"><input id="role-description" v-model="draft.description" class="input" maxlength="191" placeholder="What this person does" /></FormField>
                </div>
              </template>
              <template v-else>
                <h2 class="text-xl font-extrabold text-slate-900">{{ role.label }}</h2>
                <p class="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500"><UsersIcon class="size-4" /> {{ role.users_count }} {{ role.users_count === 1 ? 'person has' : 'people have' }} this role</p>
              </template>
            </div>
            <span class="chip" :class="role.is_custom ? 'bg-violet-50 text-violet-700 ring-violet-600/15' : 'bg-slate-100 text-slate-600 ring-slate-300'">{{ role.is_custom ? 'Custom role' : 'Built-in role' }}</span>
          </div>

          <div v-if="!role.editable" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span><LockClosedIcon class="mr-1 inline size-4" /> Set by MedLink. To change what people can do, make your own role.</span>
            <button v-if="!isPlatform" class="btn btn-secondary btn-sm" @click="openCreate(role.id)"><PlusIcon class="size-4" /> Create a role based on this one</button>
          </div>
          <div v-else-if="!role.is_custom" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>Changes apply to <b>every organization</b> using this role. Locked permissions (🔒) keep admins from being locked out.</span>
            <button v-if="role.defaults" class="btn btn-ghost btn-sm" @click="resetToDefaults"><ArrowPathIcon class="size-4" /> Reset to MedLink defaults</button>
          </div>
        </div>

        <div v-for="g in groups" :key="g.key" class="card overflow-hidden">
          <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <p class="font-bold text-slate-900">{{ g.label }} <span class="ml-1 text-xs font-semibold text-slate-400">{{ countIn(g) }}/{{ g.permissions.length }}</span></p>
            <label v-if="role.editable" class="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <input type="checkbox" class="rounded" :checked="groupState(g) === 'all'" :indeterminate.prop="groupState(g) === 'some'" @change="(e) => toggleGroup(g, e.target.checked)" /> All
            </label>
          </div>
          <ul class="divide-y divide-slate-100">
            <li v-for="p in g.permissions" :key="p.name">
              <label class="flex items-center gap-3 px-5 py-2.5" :class="canToggle(p.name) ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'">
                <input type="checkbox" class="rounded" :checked="draft.permissions.has(p.name)" :disabled="!canToggle(p.name)" @change="toggle(p.name)" />
                <span class="w-14 shrink-0"><span class="chip px-1.5 text-[0.65rem]" :class="ACTIONS[p.action][1]">{{ ACTIONS[p.action][0] }}</span></span>
                <span class="min-w-0 flex-1 text-sm text-slate-700">{{ p.label }}</span>
                <span v-if="isLocked(p.name)" class="text-xs text-slate-400" title="Kept so admins are never locked out">🔒</span>
                <span v-else-if="role.editable && !grantable.has(p.name)" class="text-xs text-slate-400" title="You can only give permissions you have yourself">not yours to give</span>
              </label>
            </li>
          </ul>
        </div>

        <div v-if="role.editable" class="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-900 px-5 py-3 text-white shadow-2xl">
          <span class="flex-1 text-sm">{{ dirty ? 'You have unsaved changes.' : `${draft.permissions.size} permissions` }}</span>
          <button v-if="role.is_custom" class="btn btn-ghost btn-sm text-rose-300 hover:bg-white/10" :disabled="role.users_count > 0" :title="role.users_count ? 'Give these people another role first' : ''" @click="remove"><TrashIcon class="size-4" /> Delete role</button>
          <button class="btn btn-gold btn-sm" :disabled="!dirty || saving" @click="save"><AppSpinner v-if="saving" /> Save</button>
        </div>
      </section>
    </div>

    <AppModal :open="creating" title="New role" subtitle="For your organization only. You can give it the permissions you have yourself." size="sm" @close="creating = false">
      <form id="new-role" class="space-y-4" @submit.prevent="create">
        <FormField label="Role name" required><input id="new-role-label" v-model="newRole.label" class="input" maxlength="60" placeholder="e.g. Store keeper" required /></FormField>
        <FormField label="Description (optional)"><input id="new-role-description" v-model="newRole.description" class="input" maxlength="191" placeholder="e.g. Receives deliveries and counts stock" /></FormField>
        <FormField label="Start from">
          <select id="new-role-from" v-model="newRole.from" class="input">
            <option value="">Nothing (choose permissions after)</option>
            <option v-for="r in data?.roles ?? []" :key="r.id" :value="r.id">{{ r.label }}{{ r.is_custom ? ' (custom)' : '' }}</option>
          </select>
        </FormField>
        <p v-if="newRole.error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ newRole.error }}</p>
      </form>
      <template #footer>
        <button class="btn btn-secondary" @click="creating = false">Cancel</button>
        <button form="new-role" class="btn btn-primary" :disabled="newRole.busy || !newRole.label.trim()"><AppSpinner v-if="newRole.busy" /> Create role</button>
      </template>
    </AppModal>
  </div>
</template>
