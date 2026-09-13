// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VCheckbox } from 'vuetify/components'
import { ref } from 'vue'
import type { AdministrationRole, AdministrationPermission } from '@/interfaces/role'

// v-checkbox / v-data-table style Vuetify internals rely on ResizeObserver in
// some layouts — same jsdom shim as RolesView.test.ts / UsersTable.test.ts.
if (!('visualViewport' in window)) {
  Object.defineProperty(window, 'visualViewport', { value: null, writable: true })
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const vuetify = createVuetify()

const role = ref<AdministrationRole | null>(null)
const permissionsCatalog = ref<AdministrationPermission[]>([])
const loading = ref(false)
const loadError = ref(false)
const canManage = ref(false)
const savePermissions = vi.fn()

vi.mock('@/composables/useRoleDetailPage', () => ({
  useRoleDetailPage: () => ({
    role,
    permissionsCatalog,
    loading,
    loadError,
    canManage,
    savePermissions,
  }),
}))

import RoleDetailView from '@/views/roles/RoleDetailView.vue'
import { useAlertStore } from '@/stores/alert'

const buildRole = (overrides: Partial<AdministrationRole> = {}): AdministrationRole => ({
  id: 5,
  name: 'SOPORTE',
  permissions: [{ id: 1, name: 'ADM_READ_ROLES' }],
  ...overrides,
})

const buildCatalog = (): AdministrationPermission[] => [
  { id: 1, name: 'ADM_READ_ROLES' },
  { id: 2, name: 'ADM_MANAGE_ROLES' },
]

const mountView = () =>
  mount(RoleDetailView, {
    global: { plugins: [vuetify] },
  })

// v-tooltip content teleports to document.body — same gotcha documented in
// RolesView.test.ts / CreateRoleDialog.test.ts.
const body = () => new DOMWrapper(document.body)

const clickGuardar = async (wrapper: ReturnType<typeof mountView>): Promise<void> => {
  for (const btn of wrapper.findAll('button')) {
    if (btn.text() === 'Guardar') {
      await btn.trigger('click')
      return
    }
  }
}

describe('RoleDetailView — loading / error / populated states', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    role.value = null
    permissionsCatalog.value = []
    loading.value = false
    loadError.value = false
    canManage.value = false
    savePermissions.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('shows a progress indicator while loading, and no checklist or error alert', () => {
    loading.value = true
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    expect(wrapper.findComponent(VCheckbox).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
  })

  it('shows an error alert instead of a silent blank checklist when loadError is true', () => {
    loadError.value = true
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
    expect(wrapper.findComponent(VCheckbox).exists()).toBe(false)
  })

  it('renders the role name and a checklist with correct pre-checked state once loaded', () => {
    role.value = buildRole()
    permissionsCatalog.value = buildCatalog()
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('SOPORTE')

    const checkboxes = wrapper.findAllComponents(VCheckbox)
    expect(checkboxes).toHaveLength(2)

    const readCheckbox = checkboxes.find((c) => c.props('label') === 'ADM_READ_ROLES')
    const manageCheckbox = checkboxes.find((c) => c.props('label') === 'ADM_MANAGE_ROLES')

    expect(readCheckbox?.find('input').element.checked).toBe(true)
    expect(manageCheckbox?.find('input').element.checked).toBe(false)
  })

  it('does not render an enabled Guardar button when the user cannot manage roles', () => {
    role.value = buildRole()
    permissionsCatalog.value = buildCatalog()
    canManage.value = false
    const wrapper = mountView()

    const guardarButtons = wrapper.findAll('button').filter((b) => b.text() === 'Guardar')
    expect(guardarButtons.length).toBeGreaterThan(0)
    expect(guardarButtons[0].attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent({ name: 'VTooltip' }).exists()).toBe(true)
  })

  it('renders an enabled Guardar button when the user can manage roles', () => {
    role.value = buildRole()
    permissionsCatalog.value = buildCatalog()
    canManage.value = true
    const wrapper = mountView()

    const guardarButtons = wrapper.findAll('button').filter((b) => b.text() === 'Guardar')
    expect(guardarButtons.length).toBeGreaterThan(0)
    expect(guardarButtons[0].attributes('disabled')).toBeUndefined()
  })

  it('calls savePermissions with the currently checked permission ids on Guardar', async () => {
    role.value = buildRole()
    permissionsCatalog.value = buildCatalog()
    canManage.value = true
    savePermissions.mockResolvedValue(undefined)

    const wrapper = mountView()
    const manageCheckbox = wrapper.findAllComponents(VCheckbox).find((c) => c.props('label') === 'ADM_MANAGE_ROLES')
    await manageCheckbox?.find('input').setValue(true)

    await clickGuardar(wrapper)
    await flushPromises()

    expect(savePermissions).toHaveBeenCalledWith([1, 2])
  })

  it('shows a success alert after Guardar succeeds', async () => {
    role.value = buildRole()
    permissionsCatalog.value = buildCatalog()
    canManage.value = true
    savePermissions.mockResolvedValue(undefined)

    const wrapper = mountView()
    await clickGuardar(wrapper)
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('success')
  })

  it('shows an error alert after Guardar fails, without crashing', async () => {
    role.value = buildRole()
    permissionsCatalog.value = buildCatalog()
    canManage.value = true
    savePermissions.mockRejectedValue(new Error('422'))

    const wrapper = mountView()
    await clickGuardar(wrapper)
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
  })
})
