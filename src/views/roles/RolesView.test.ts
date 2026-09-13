// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
import { ref } from 'vue'
import type { AdministrationRole } from '@/interfaces/role'

// v-data-table's pagination footer relies on ResizeObserver — same jsdom
// shim as UsersTable.test.ts / PersonsView.test.ts.
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

const roles = ref<AdministrationRole[]>([])
const loading = ref(false)
const loadError = ref(false)
const canManage = ref(false)

// CreateRoleDialog uses the REAL rolesStore (not mocked at the composable
// level like useRolesPage above), so the "list stays in sync" test can spy
// on the actual HTTP call and observe the real store's reactive Map update
// — the same contract rolesStore.test.ts already verifies for createRole in
// isolation.
const { mockAxiosPost } = vi.hoisted(() => ({ mockAxiosPost: vi.fn() }))
vi.mock('@/axiosConfig', () => ({
  default: { post: mockAxiosPost },
}))

vi.mock('@/composables/useRolesPage', () => ({
  useRolesPage: () => ({
    roles,
    loading,
    loadError,
    canManage,
  }),
}))

// RolesTable's eye icon calls useRouter().push — same guard as
// PersonsView.test.ts / UsersTable.test.ts.
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import RolesView from '@/views/roles/RolesView.vue'
import { useRolesStore } from '@/stores/api/rolesStore'

const vuetify = createVuetify()

const buildRole = (overrides: Partial<AdministrationRole> = {}): AdministrationRole => ({
  id: 1,
  name: 'ROOT_ADMINISTRATION',
  permissions: [{ id: 1, name: 'ADM_READ_ROLES' }],
  ...overrides,
})

const mountView = () =>
  mount(RolesView, {
    global: { plugins: [vuetify] },
  })

// CreateRoleDialog's v-dialog content teleports to `document.body`, same
// gotcha as PaymentDataDialog.test.ts / CreateRoleDialog.test.ts.
const body = () => new DOMWrapper(document.body)

const fieldByLabelPrefix = (wrapper: ReturnType<typeof mountView>, label: string) =>
  wrapper.findAllComponents(VTextField).find((f) => (f.props('label') as string | undefined)?.startsWith(label))

const submitCreateForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

describe('RolesView — loading / error / populated states', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    roles.value = []
    loading.value = false
    loadError.value = false
    canManage.value = false
    mockAxiosPost.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('shows a progress indicator while loading, and no table or error alert', () => {
    loading.value = true
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VDataTable' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
  })

  it('shows an error alert instead of a silent blank table when loadError is true', () => {
    loadError.value = true
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VDataTable' }).exists()).toBe(false)
  })

  it('renders the populated table without an error alert once loaded', () => {
    roles.value = [buildRole({ name: 'ROOT_ADMINISTRATION' })]
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('ROOT_ADMINISTRATION')
  })

  it('does not render an "Agregar" button when the user cannot manage roles', () => {
    canManage.value = false
    const wrapper = mountView()

    expect(wrapper.text()).not.toContain('Agregar')
  })

  it('renders an "Agregar" button when the user can manage roles', () => {
    canManage.value = true
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Agregar')
  })

  it('opens CreateRoleDialog when "Agregar" is clicked', async () => {
    canManage.value = true
    const wrapper = mountView()

    for (const btn of wrapper.findAll('button')) {
      if (btn.text() === 'Agregar') await btn.trigger('click')
    }
    await flushPromises()

    expect(body().text()).toContain('Nuevo rol')
  })

  it('closes the dialog and keeps the store in sync when a role is created successfully', async () => {
    canManage.value = true
    const created = buildRole({ id: 5, name: 'SOPORTE' })
    mockAxiosPost.mockResolvedValueOnce({ data: { res: true, role: created } })

    const rolesStore = useRolesStore()
    const wrapper = mountView()
    for (const btn of wrapper.findAll('button')) {
      if (btn.text() === 'Agregar') await btn.trigger('click')
    }
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Nombre')?.setValue('SOPORTE')
    await submitCreateForm()
    await flushPromises()

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/administration-roles', { name: 'SOPORTE' })
    expect(rolesStore.allRoles.get(5)).toEqual(created)
    // v-dialog keeps its content in the DOM after close (hidden via
    // transition, not unmounted) — same reason PaymentDataDialog.test.ts
    // asserts on the emitted `update:modelValue` event rather than on DOM
    // text absence.
    const dialog = wrapper.findComponent({ name: 'VDialog' })
    expect(dialog.props('modelValue')).toBe(false)
  })
})
