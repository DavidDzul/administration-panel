// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VBtn, VSelect } from 'vuetify/components'
import UsersTable from '@/components/users/UsersTable.vue'
import type { Person } from '@/interfaces/user'
import type { Generation } from '@/interfaces/generation'
import { campusArray } from '@/constants'

// PR3b (sdd/becarios-payment-config): the eye icon now navigates via
// `router.push` — mirrors authStore.test.ts's `vi.mock('vue-router', ...)`
// pattern rather than mounting a real router, since this component only
// needs `push` to be observable, not real navigation.
const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// v-menu/v-tooltip content teleports/lazily renders — same jsdom shims used
// elsewhere in this codebase (e.g. AprobacionRefrendTable.test.ts in
// psicol-panel) for Vuetify's overlay strategy.
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

const buildPerson = (overrides: Partial<Person> = {}): Person => ({
  id: 1,
  enrollment: 'A0001',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@iu.org.mx',
  phone: '9990000000',
  user_type: 'BEC_ACTIVE',
  campus: 'MERIDA',
  generation_id: 1,
  active: true,
  ...overrides,
})

const generations: Generation[] = [
  { id: 1, campus: 'MERIDA', generation_active: true, generation_name: 'Gen Mérida' },
  { id: 2, campus: 'VALLADOLID', generation_active: true, generation_name: 'Gen Valladolid' },
]

const mountTable = (persons: Person[] = [buildPerson()], canEdit = false) =>
  mount(UsersTable, {
    props: { persons, generations, campusOptions: campusArray, canEdit },
    global: { plugins: [vuetify] },
  })

// The 3 filter v-selects (Tipo, Sede, Generación, in that declaration order)
// live inside a v-menu that only mounts its content once opened.
const openFilterMenu = async (wrapper: ReturnType<typeof mountTable>) => {
  const filterBtn = wrapper.findAllComponents(VBtn).find((b) => b.props('icon') === 'mdi-filter')
  if (!filterBtn) throw new Error('Filter button (mdi-filter) not found')
  await filterBtn.trigger('click')
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
}

describe('UsersTable — Tipo column visibility', () => {
  it('shows the Tipo column when no tipo filter is applied', () => {
    const wrapper = mountTable()
    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers.some((h) => h.includes('Tipo'))).toBe(true)
  })

  it('hides the Tipo column once a tipo filter is selected', async () => {
    const wrapper = mountTable()
    await openFilterMenu(wrapper)

    const selects = wrapper.findAllComponents(VSelect)
    await selects[0].vm.$emit('update:modelValue', 'BEC_ACTIVE')
    await wrapper.vm.$nextTick()

    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers.some((h) => h.includes('Tipo'))).toBe(false)
  })
})

describe('UsersTable — sede → generación reset', () => {
  it('resets the selected generación when the sede filter changes', async () => {
    const wrapper = mountTable()
    await openFilterMenu(wrapper)

    let selects = wrapper.findAllComponents(VSelect)
    // index 1 = Sede, index 2 = Generación (declaration order: Tipo, Sede, Generación)
    await selects[1].vm.$emit('update:modelValue', 'MERIDA')
    await wrapper.vm.$nextTick()

    selects = wrapper.findAllComponents(VSelect)
    await selects[2].vm.$emit('update:modelValue', 1)
    await wrapper.vm.$nextTick()

    selects = wrapper.findAllComponents(VSelect)
    expect(selects[2].props('modelValue')).toBe(1)

    await selects[1].vm.$emit('update:modelValue', 'VALLADOLID')
    await wrapper.vm.$nextTick()

    selects = wrapper.findAllComponents(VSelect)
    expect(selects[2].props('modelValue')).toBeNull()
  })
})

describe('UsersTable — filters narrow the result set (spec: "Sede filter narrows results")', () => {
  it('shows only rows matching the selected sede', async () => {
    const merida = buildPerson({ id: 1, campus: 'MERIDA', first_name: 'Merida Person' })
    const valladolid = buildPerson({ id: 2, campus: 'VALLADOLID', first_name: 'Valladolid Person' })
    const wrapper = mountTable([merida, valladolid])
    await openFilterMenu(wrapper)

    const selects = wrapper.findAllComponents(VSelect)
    await selects[1].vm.$emit('update:modelValue', 'MERIDA')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Merida Person')
    expect(wrapper.text()).not.toContain('Valladolid Person')
  })

  it('shows the empty state ("No existen datos registrados") instead of a blank table when filters match nothing', async () => {
    const merida = buildPerson({ id: 1, campus: 'MERIDA' })
    const wrapper = mountTable([merida])
    await openFilterMenu(wrapper)

    const selects = wrapper.findAllComponents(VSelect)
    await selects[1].vm.$emit('update:modelValue', 'TIZIMIN')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('No existen datos registrados')
  })
})

describe('UsersTable — eye navigation and pencil edit emit (PR3b, sdd/becarios-payment-config)', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  it('eye icon is always enabled and navigates to /becarios/:id on click, regardless of canEdit', async () => {
    const person = buildPerson({ id: 7 })
    const wrapper = mountTable([person], false)

    const eyeButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-eye')
    expect(eyeButtons).toHaveLength(1)
    expect(eyeButtons[0].props('disabled')).toBeFalsy()

    await eyeButtons[0].trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/becarios/7')
  })

  // This is the regression guard for the prior fully-inert state: against
  // the old always-`disabled` pencil (D6), this assertion would have failed
  // because the button could never receive a click / never emit.
  it('pencil icon is enabled and emits "edit" with the row person when canEdit is true', async () => {
    const person = buildPerson({ id: 3 })
    const wrapper = mountTable([person], true)

    const pencilButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-pencil')
    expect(pencilButtons).toHaveLength(1)
    expect(pencilButtons[0].props('disabled')).toBeFalsy()

    await pencilButtons[0].trigger('click')

    expect(wrapper.emitted('edit')).toEqual([[person]])
  })

  it('pencil icon is disabled when canEdit is false (default) and does not emit on click', async () => {
    const wrapper = mountTable([buildPerson()], false)

    const pencilButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-pencil')
    expect(pencilButtons[0].props('disabled')).toBe(true)

    await pencilButtons[0].trigger('click')

    expect(wrapper.emitted('edit')).toBeUndefined()
  })

  it('renders no delete icon anywhere', () => {
    const wrapper = mountTable([buildPerson()])
    const deleteButtons = wrapper.findAllComponents(VBtn).filter((b) => b.props('icon') === 'mdi-delete')
    expect(deleteButtons).toHaveLength(0)
  })
})
