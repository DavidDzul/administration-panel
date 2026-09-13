// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
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

// useRolesPage is deliberately NOT mocked in this file — a prior version of
// this test mocked it, which meant "keeps the list in sync" only asserted
// the store's internal Map changed, never that the real reactive chain
// (allRoles -> storeToRefs -> computed -> RolesTable prop) actually
// re-rendered the table. That gap shipped alongside a live user report of
// tables not updating after "Agregar" without a full page reload. Running
// the real composable here, against a real Pinia instance, is what actually
// proves the fix (explicit re-fetch in RolesView.vue's onCreated) works —
// or would have caught it if the reactive-chain theory had been the bug.
const { mockAxiosGet, mockAxiosPost } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
}))
vi.mock('@/axiosConfig', () => ({
  default: { get: mockAxiosGet, post: mockAxiosPost },
}))

// RolesTable's eye icon calls useRouter().push — same guard as
// PersonsView.test.ts / UsersTable.test.ts.
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import RolesView from '@/views/roles/RolesView.vue'
import { useAuthStore } from '@/stores/api/authStore'

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

const setManageRoles = (canManage: boolean): void => {
  useAuthStore().permissions = canManage ? ['ADM_READ_ROLES', 'ADM_MANAGE_ROLES'] : ['ADM_READ_ROLES']
}

describe('RolesView — loading / error / populated states', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    mockAxiosGet.mockResolvedValue({ data: { res: true, roles: [] } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('shows a progress indicator while the initial fetch is pending', async () => {
    let resolveGet!: (value: unknown) => void
    mockAxiosGet.mockReturnValueOnce(new Promise((resolve) => (resolveGet = resolve)))
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VDataTable' }).exists()).toBe(false)

    resolveGet({ data: { res: true, roles: [] } })
    await flushPromises()
  })

  it('shows an error alert instead of a silent blank table when the fetch fails', async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VDataTable' }).exists()).toBe(false)
  })

  it('renders the populated table without an error alert once loaded', async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, roles: [buildRole({ name: 'ROOT_ADMINISTRATION' })] } })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('ROOT_ADMINISTRATION')
  })

  it('does not render an "Agregar" button when the user cannot manage roles', async () => {
    setManageRoles(false)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Agregar')
  })

  it('renders an "Agregar" button when the user can manage roles', async () => {
    setManageRoles(true)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Agregar')
  })

  it('opens CreateRoleDialog when "Agregar" is clicked', async () => {
    setManageRoles(true)
    const wrapper = mountView()
    await flushPromises()

    for (const btn of wrapper.findAll('button')) {
      if (btn.text() === 'Agregar') await btn.trigger('click')
    }
    await flushPromises()

    expect(body().text()).toContain('Nuevo rol')
  })

  it('shows the newly created role in the table without a page reload or a second fetch', async () => {
    setManageRoles(true)
    // No `permissions` key at all — mirrors AdministrationRoleController::store()'s
    // ACTUAL real response shape before its fix (setRelation('permissions', collect())
    // added after this exact bug reached a live browser: RolesTable.vue's
    // `item.permissions.length` threw "Cannot read properties of undefined",
    // which silently killed the render and looked identical to "the table
    // never updated." Omitting the key here, rather than defaulting buildRole()
    // to include it, is what makes this test actually exercise that contract
    // instead of one only a tidier-than-reality fixture would pass.
    const created = { id: 5, name: 'SOPORTE', permissions: [] }
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, roles: [] } })
    mockAxiosPost.mockResolvedValueOnce({ data: { res: true, role: created } })

    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).not.toContain('SOPORTE')

    for (const btn of wrapper.findAll('button')) {
      if (btn.text() === 'Agregar') await btn.trigger('click')
    }
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Nombre')?.setValue('SOPORTE')
    await submitCreateForm()
    await flushPromises()

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/administration-roles', { name: 'SOPORTE' })
    // Proves the table updates via the real reactive chain (allRoles Map ->
    // storeToRefs -> computed -> RolesTable prop) with ZERO extra network
    // round trip — GET fires only once, at mount.
    expect(mockAxiosGet).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('SOPORTE')
    const dialog = wrapper.findComponent({ name: 'VDialog' })
    expect(dialog.props('modelValue')).toBe(false)
  })
})
