// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VSelect } from 'vuetify/components'
import { ref } from 'vue'
import type { Administrator } from '@/interfaces/administrator'
import type { AdministrationRole } from '@/interfaces/role'

// Same jsdom shim as RoleDetailView.test.ts / RolesView.test.ts / UsersTable.test.ts.
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

const administrator = ref<Administrator | null>(null)
const currentRole = ref<AdministrationRole | null>(null)
const availableRoles = ref<AdministrationRole[]>([])
const loading = ref(false)
const loadError = ref(false)
const canManage = ref(false)
const assignRole = vi.fn()

vi.mock('@/composables/useAccesoDetailPage', () => ({
  useAccesoDetailPage: () => ({
    administrator,
    currentRole,
    availableRoles,
    loading,
    loadError,
    canManage,
    assignRole,
  }),
}))

import AccesoDetailView from '@/views/accesos/AccesoDetailView.vue'
import { useAlertStore } from '@/stores/alert'

const buildAdministrator = (overrides: Partial<Administrator> = {}): Administrator => ({
  id: 9,
  first_name: 'Ana',
  last_name: 'Pérez',
  email: 'ana@example.com',
  roles: [],
  ...overrides,
})

const buildRoles = (): AdministrationRole[] => [
  { id: 1, name: 'SOPORTE', permissions: [] },
  { id: 2, name: 'ROOT_ADMINISTRATION', permissions: [] },
]

const mountView = () =>
  mount(AccesoDetailView, {
    global: { plugins: [vuetify] },
  })

// v-tooltip content teleports to document.body — same gotcha documented in
// RoleDetailView.test.ts / RolesView.test.ts / CreateRoleDialog.test.ts.
const body = () => new DOMWrapper(document.body)

const clickGuardar = async (wrapper: ReturnType<typeof mountView>): Promise<void> => {
  for (const btn of wrapper.findAll('button')) {
    if (btn.text() === 'Guardar') {
      await btn.trigger('click')
      return
    }
  }
}

describe('AccesoDetailView — loading / error / populated states', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    administrator.value = null
    currentRole.value = null
    availableRoles.value = []
    loading.value = false
    loadError.value = false
    canManage.value = false
    assignRole.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('shows a progress indicator while loading, and no identity card or role select', () => {
    loading.value = true
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    expect(wrapper.findComponent(VSelect).exists()).toBe(false)
  })

  it('shows an error alert instead of a broken detail view when loadError is true', () => {
    loadError.value = true
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
    expect(wrapper.findComponent(VSelect).exists()).toBe(false)
  })

  it('renders the identity header (nombre, correo) once loaded', () => {
    administrator.value = buildAdministrator()
    availableRoles.value = buildRoles()
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('Ana Pérez')
    expect(wrapper.text()).toContain('ana@example.com')
  })

  it('pre-selects the role select with the administrator current role', () => {
    administrator.value = buildAdministrator()
    availableRoles.value = buildRoles()
    currentRole.value = buildRoles()[0]
    const wrapper = mountView()

    expect(wrapper.findComponent(VSelect).props('modelValue')).toBe(1)
  })

  it('leaves the role select as a valid empty ("sin rol") selection without crashing when no role is assigned yet', () => {
    administrator.value = buildAdministrator()
    availableRoles.value = buildRoles()
    currentRole.value = null

    expect(() => mountView()).not.toThrow()

    const wrapper = mountView()
    expect(wrapper.findComponent(VSelect).exists()).toBe(true)
    expect(wrapper.findComponent(VSelect).props('modelValue')).toBeNull()
  })

  it('does not render an enabled Guardar button when the user cannot manage accesos', () => {
    administrator.value = buildAdministrator()
    availableRoles.value = buildRoles()
    currentRole.value = buildRoles()[0]
    canManage.value = false
    const wrapper = mountView()

    const guardarButtons = wrapper.findAll('button').filter((b) => b.text() === 'Guardar')
    expect(guardarButtons.length).toBeGreaterThan(0)
    expect(guardarButtons[0].attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent({ name: 'VTooltip' }).exists()).toBe(true)
  })

  it('renders an enabled Guardar button when the user can manage accesos', () => {
    administrator.value = buildAdministrator()
    availableRoles.value = buildRoles()
    currentRole.value = buildRoles()[0]
    canManage.value = true
    const wrapper = mountView()

    const guardarButtons = wrapper.findAll('button').filter((b) => b.text() === 'Guardar')
    expect(guardarButtons.length).toBeGreaterThan(0)
    expect(guardarButtons[0].attributes('disabled')).toBeUndefined()
  })

  it('calls assignRole with the currently selected role id on Guardar', async () => {
    administrator.value = buildAdministrator()
    availableRoles.value = buildRoles()
    currentRole.value = buildRoles()[0]
    canManage.value = true
    assignRole.mockResolvedValue(undefined)

    const wrapper = mountView()
    await wrapper.findComponent(VSelect).vm.$emit('update:modelValue', 2)
    await wrapper.vm.$nextTick()

    await clickGuardar(wrapper)
    await flushPromises()

    expect(assignRole).toHaveBeenCalledWith(2)
  })

  it('shows a success alert after Guardar succeeds', async () => {
    administrator.value = buildAdministrator()
    availableRoles.value = buildRoles()
    currentRole.value = buildRoles()[0]
    canManage.value = true
    assignRole.mockResolvedValue(undefined)

    const wrapper = mountView()
    await clickGuardar(wrapper)
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('success')
  })

  it('surfaces the backend self-demotion message specifically, not a generic fallback', async () => {
    administrator.value = buildAdministrator()
    availableRoles.value = buildRoles()
    currentRole.value = buildRoles()[0]
    canManage.value = true
    assignRole.mockRejectedValue({
      response: { data: { res: false, msg: 'No puedes modificar tu propia asignación de rol.' } },
    })

    const wrapper = mountView()
    await clickGuardar(wrapper)
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('No puedes modificar tu propia asignación de rol.')
  })

  it('surfaces a role-validation field error when the backend rejects the role id', async () => {
    administrator.value = buildAdministrator()
    availableRoles.value = buildRoles()
    currentRole.value = buildRoles()[0]
    canManage.value = true
    assignRole.mockRejectedValue({
      response: { data: { errors: { role_id: ['El rol seleccionado no es válido.'] } } },
    })

    const wrapper = mountView()
    await clickGuardar(wrapper)
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('El rol seleccionado no es válido.')
  })

  it('shows a generic error alert when the failure has no field-specific message', async () => {
    administrator.value = buildAdministrator()
    availableRoles.value = buildRoles()
    currentRole.value = buildRoles()[0]
    canManage.value = true
    assignRole.mockRejectedValue(new Error('network error'))

    const wrapper = mountView()
    await clickGuardar(wrapper)
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('Error al asignar el rol, intenta nuevamente.')
  })
})
