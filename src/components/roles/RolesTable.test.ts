// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VBtn } from 'vuetify/components'
import RolesTable from '@/components/roles/RolesTable.vue'
import type { AdministrationRole } from '@/interfaces/role'

// Mirrors UsersTable.test.ts's `vi.mock('vue-router', ...)` pattern — the eye
// icon only needs `push` to be observable, not real navigation.
const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// v-data-table's pagination footer relies on ResizeObserver — same jsdom
// shim as UsersTable.test.ts.
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

const buildRole = (overrides: Partial<AdministrationRole> = {}): AdministrationRole => ({
  id: 1,
  name: 'ROOT_ADMINISTRATION',
  permissions: [
    { id: 1, name: 'ADM_READ_ROLES' },
    { id: 2, name: 'ADM_MANAGE_ROLES' },
  ],
  ...overrides,
})

const mountTable = (roles: AdministrationRole[] = [buildRole()], loading = false) =>
  mount(RolesTable, {
    props: { roles, loading },
    global: { plugins: [vuetify] },
  })

describe('RolesTable — renders rows', () => {
  it('renders the role name and permission count for each row', () => {
    const wrapper = mountTable([buildRole({ name: 'ROOT_ADMINISTRATION' })])

    expect(wrapper.text()).toContain('ROOT_ADMINISTRATION')
    expect(wrapper.text()).toContain('2')
  })

  it('shows the empty state ("No existen datos registrados") when there are no roles', () => {
    const wrapper = mountTable([])

    expect(wrapper.text()).toContain('No existen datos registrados')
  })

  it('passes the loading prop through to the underlying v-data-table', () => {
    const wrapper = mountTable([buildRole()], true)

    expect(wrapper.findComponent({ name: 'VDataTable' }).props('loading')).toBe(true)
  })

  it('renders no edit or delete icon anywhere (permission editing happens in the detail view)', () => {
    const wrapper = mountTable([buildRole()])

    const pencilButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-pencil')
    const deleteButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-delete')
    expect(pencilButtons).toHaveLength(0)
    expect(deleteButtons).toHaveLength(0)
  })
})

describe('RolesTable — eye navigation', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  it('navigates to /control/roles/:id when the eye icon is clicked', async () => {
    const wrapper = mountTable([buildRole({ id: 42 })])

    const eyeButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-eye')
    expect(eyeButtons).toHaveLength(1)

    await eyeButtons[0].trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/control/roles/42')
  })
})
