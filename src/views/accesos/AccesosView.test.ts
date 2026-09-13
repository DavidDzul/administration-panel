// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
import type { Administrator } from '@/interfaces/administrator'

// v-data-table's pagination footer relies on ResizeObserver — same jsdom
// shim as RolesView.test.ts.
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

// useAccesosPage is deliberately NOT mocked in this file — see
// RolesView.test.ts's identical note. Mocking it here previously meant
// "keeps the list in sync" only asserted the store's internal Map changed,
// never that the real reactive chain actually re-rendered the table, which
// is exactly the gap behind a live user report of stale tables after
// "Agregar" until a full page reload.
const { mockAxiosGet, mockAxiosPost } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
}))
vi.mock('@/axiosConfig', () => ({
  default: { get: mockAxiosGet, post: mockAxiosPost },
}))

// AccesosTable's eye icon calls useRouter().push — same guard as
// RolesTable.test.ts / RolesView.test.ts.
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import AccesosView from '@/views/accesos/AccesosView.vue'
import { useAuthStore } from '@/stores/api/authStore'

const vuetify = createVuetify()

const buildAdministrator = (overrides: Partial<Administrator> = {}): Administrator => ({
  id: 1,
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  roles: [{ id: 1, name: 'ROOT_ADMINISTRATION', permissions: [] }],
  ...overrides,
})

const mountView = () =>
  mount(AccesosView, {
    global: { plugins: [vuetify] },
  })

// CreateAccesoDialog's v-dialog content teleports to `document.body`, same
// gotcha as RolesView.test.ts.
const body = () => new DOMWrapper(document.body)

const fieldByLabelPrefix = (wrapper: ReturnType<typeof mountView>, label: string) =>
  wrapper.findAllComponents(VTextField).find((f) => (f.props('label') as string | undefined)?.startsWith(label))

const submitCreateForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

const setManageAdmins = (canManage: boolean): void => {
  useAuthStore().permissions = canManage ? ['ADM_READ_ADMINS', 'ADM_MANAGE_ADMINS'] : ['ADM_READ_ADMINS']
}

describe('AccesosView — loading / error / populated states', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    mockAxiosGet.mockResolvedValue({ data: { res: true, administrators: [] } })
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

    resolveGet({ data: { res: true, administrators: [] } })
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
    mockAxiosGet.mockResolvedValueOnce({
      data: { res: true, administrators: [buildAdministrator({ first_name: 'Grace', last_name: 'Hopper' })] },
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('Grace Hopper')
  })

  it('does not render an "Agregar" button when the user cannot manage administrators', async () => {
    setManageAdmins(false)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Agregar')
  })

  it('renders an "Agregar" button when the user can manage administrators', async () => {
    setManageAdmins(true)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Agregar')
  })

  it('opens CreateAccesoDialog when "Agregar" is clicked', async () => {
    setManageAdmins(true)
    const wrapper = mountView()
    await flushPromises()

    for (const btn of wrapper.findAll('button')) {
      if (btn.text() === 'Agregar') await btn.trigger('click')
    }
    await flushPromises()

    expect(body().text()).toContain('Nuevo acceso')
  })

  it('shows the newly created administrator in the table without a page reload or a second fetch', async () => {
    setManageAdmins(true)
    // No `roles` key at all — mirrors AdministratorController::store()'s
    // ACTUAL real response shape before its fix (setRelation('roles', collect())
    // added after this exact bug reached a live browser: AccesosTable.vue's
    // `item.roles[0]?.name` threw "Cannot read properties of undefined",
    // which silently killed the render and looked identical to "the table
    // never updated." Omitting the key here, rather than defaulting
    // buildAdministrator() to include it, is what makes this test actually
    // exercise that contract instead of one only a tidier-than-reality
    // fixture would pass.
    const created = { id: 9, first_name: 'Marie', last_name: 'Curie', email: 'marie@example.com', roles: [] }
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, administrators: [] } })
    mockAxiosPost.mockResolvedValueOnce({ data: { res: true, administrator: created } })

    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Marie Curie')

    for (const btn of wrapper.findAll('button')) {
      if (btn.text() === 'Agregar') await btn.trigger('click')
    }
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Nombre')?.setValue('Marie')
    await fieldByLabelPrefix(wrapper, 'Apellido')?.setValue('Curie')
    await fieldByLabelPrefix(wrapper, 'Correo')?.setValue('marie@example.com')
    await fieldByLabelPrefix(wrapper, 'Contraseña')?.setValue('supersecret')
    await submitCreateForm()
    await flushPromises()

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/administrators', {
      first_name: 'Marie',
      last_name: 'Curie',
      email: 'marie@example.com',
      password: 'supersecret',
    })
    // Proves the table updates via the real reactive chain with ZERO extra
    // network round trip — GET fires only once, at mount.
    expect(mockAxiosGet).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Marie Curie')
    const dialog = wrapper.findComponent({ name: 'VDialog' })
    expect(dialog.props('modelValue')).toBe(false)
  })
})
