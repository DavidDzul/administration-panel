// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
import { ref } from 'vue'
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

const administrators = ref<Administrator[]>([])
const loading = ref(false)
const loadError = ref(false)
const canManage = ref(false)

// CreateAccesoDialog uses the REAL administratorsStore (not mocked at the
// composable level like useAccesosPage above), so the "list stays in sync"
// test can spy on the actual HTTP call and observe the real store's
// reactive Map update — same contract administratorsStore.test.ts already
// verifies for createAdministrator in isolation. Mirrors RolesView.test.ts's
// identical PR6b precedent.
const { mockAxiosPost } = vi.hoisted(() => ({ mockAxiosPost: vi.fn() }))
vi.mock('@/axiosConfig', () => ({
  default: { post: mockAxiosPost },
}))

vi.mock('@/composables/useAccesosPage', () => ({
  useAccesosPage: () => ({
    administrators,
    loading,
    loadError,
    canManage,
  }),
}))

// AccesosTable's eye icon calls useRouter().push — same guard as
// RolesTable.test.ts / RolesView.test.ts.
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import AccesosView from '@/views/accesos/AccesosView.vue'
import { useAdministratorsStore } from '@/stores/api/administratorsStore'

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

describe('AccesosView — loading / error / populated states', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    administrators.value = []
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
    administrators.value = [buildAdministrator({ first_name: 'Grace', last_name: 'Hopper' })]
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('Grace Hopper')
  })

  it('does not render an "Agregar" button when the user cannot manage administrators', () => {
    canManage.value = false
    const wrapper = mountView()

    expect(wrapper.text()).not.toContain('Agregar')
  })

  it('renders an "Agregar" button when the user can manage administrators', () => {
    canManage.value = true
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Agregar')
  })

  it('opens CreateAccesoDialog when "Agregar" is clicked', async () => {
    canManage.value = true
    const wrapper = mountView()

    for (const btn of wrapper.findAll('button')) {
      if (btn.text() === 'Agregar') await btn.trigger('click')
    }
    await flushPromises()

    expect(body().text()).toContain('Nuevo acceso')
  })

  it('closes the dialog and keeps the administrators list in sync when an acceso is created successfully', async () => {
    canManage.value = true
    const created = buildAdministrator({
      id: 9,
      first_name: 'Marie',
      last_name: 'Curie',
      email: 'marie@example.com',
      roles: [],
    })
    mockAxiosPost.mockResolvedValueOnce({ data: { res: true, administrator: created } })

    const administratorsStore = useAdministratorsStore()
    const wrapper = mountView()
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
    expect(administratorsStore.allAdministrators.get(9)).toEqual(created)
    const dialog = wrapper.findComponent({ name: 'VDialog' })
    expect(dialog.props('modelValue')).toBe(false)
  })
})
