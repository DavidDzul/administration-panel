// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VBtn } from 'vuetify/components'
import AccesosTable from '@/components/accesos/AccesosTable.vue'
import type { Administrator } from '@/interfaces/administrator'

// Mirrors RolesTable.test.ts's `vi.mock('vue-router', ...)` pattern — the eye
// icon only needs `push` to be observable, not real navigation.
const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// v-data-table's pagination footer relies on ResizeObserver — same jsdom
// shim as RolesTable.test.ts.
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

const buildAdministrator = (overrides: Partial<Administrator> = {}): Administrator => ({
  id: 1,
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  roles: [{ id: 1, name: 'ROOT_ADMINISTRATION', permissions: [] }],
  ...overrides,
})

const mountTable = (administrators: Administrator[] = [buildAdministrator()], loading = false) =>
  mount(AccesosTable, {
    props: { administrators, loading },
    global: { plugins: [vuetify] },
  })

describe('AccesosTable — renders rows', () => {
  it('renders the full name, email, and current role for each row', () => {
    const wrapper = mountTable([buildAdministrator()])

    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('ada@example.com')
    expect(wrapper.text()).toContain('ROOT_ADMINISTRATION')
  })

  it('falls back to "—" when the administrator has no role assigned', () => {
    const wrapper = mountTable([buildAdministrator({ roles: [] })])

    expect(wrapper.text()).toContain('—')
  })

  it('shows the empty state ("No existen datos registrados") when there are no administrators', () => {
    const wrapper = mountTable([])

    expect(wrapper.text()).toContain('No existen datos registrados')
  })

  it('passes the loading prop through to the underlying v-data-table', () => {
    const wrapper = mountTable([buildAdministrator()], true)

    expect(wrapper.findComponent({ name: 'VDataTable' }).props('loading')).toBe(true)
  })

  it('renders no edit or delete icon anywhere (role assignment happens in the detail view)', () => {
    const wrapper = mountTable([buildAdministrator()])

    const pencilButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-pencil')
    const deleteButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-delete')
    expect(pencilButtons).toHaveLength(0)
    expect(deleteButtons).toHaveLength(0)
  })
})

describe('AccesosTable — eye navigation', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  it('navigates to /control/accesos/:id when the eye icon is clicked', async () => {
    const wrapper = mountTable([buildAdministrator({ id: 42 })])

    const eyeButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-eye')
    expect(eyeButtons).toHaveLength(1)

    await eyeButtons[0].trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/control/accesos/42')
  })
})
