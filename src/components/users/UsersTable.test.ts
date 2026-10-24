// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VBtn, VChip, VSelect, VTooltip } from 'vuetify/components'
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

  it('hides the Tipo column once a single tipo is selected', async () => {
    const wrapper = mountTable()
    await openFilterMenu(wrapper)

    const selects = wrapper.findAllComponents(VSelect)
    await selects[0].vm.$emit('update:modelValue', ['BEC_ACTIVE'])
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

// sdd/egresado-baja-definitiva (PR4, task 4.6, amendment #1991): a becario
// with users.active=false is shown as "Baja" with its own chip, distinct
// from the existing user_type chip (BEC_ACTIVE/BEC_INACTIVE), and lists can
// filter by it. No new user_type — BEC_ACTIVE + active=false is still
// possible and must read "Baja", not "Becario/a".
describe('UsersTable — "Baja" chip (active=false, amendment #1991)', () => {
  it('renders a "Baja" chip (distinct/error color) in the Activo column when active is false', () => {
    const wrapper = mountTable([buildPerson({ id: 1, active: false })])

    const bajaChip = wrapper.findAllComponents(VChip).find((c) => c.text() === 'Baja')
    expect(bajaChip).toBeTruthy()
    expect(bajaChip?.props('color')).toBe('error')
  })

  it('does not render a "Baja" chip when active is true', () => {
    const wrapper = mountTable([buildPerson({ id: 1, active: true })])

    const bajaChip = wrapper.findAllComponents(VChip).find((c) => c.text() === 'Baja')
    expect(bajaChip).toBeUndefined()
  })
})

describe('UsersTable — Estado filter (Activos / Baja / Todos, amendment #1991)', () => {
  // Regression guard for "default view behavior must not hide anyone who is
  // visible today" — no Estado filter selected (default) must show both
  // active and inactive rows, exactly like before this feature existed.
  it('shows both active and inactive persons by default (no Estado filter applied)', () => {
    const activePerson = buildPerson({ id: 1, first_name: 'Activa Person', active: true })
    const bajaPerson = buildPerson({ id: 2, first_name: 'Baja Person', active: false })
    const wrapper = mountTable([activePerson, bajaPerson])

    expect(wrapper.text()).toContain('Activa Person')
    expect(wrapper.text()).toContain('Baja Person')
  })

  it('shows only inactive (Baja) persons when the Estado filter is set to "inactive"', async () => {
    const activePerson = buildPerson({ id: 1, first_name: 'Activa Person', active: true })
    const bajaPerson = buildPerson({ id: 2, first_name: 'Baja Person', active: false })
    const wrapper = mountTable([activePerson, bajaPerson])
    await openFilterMenu(wrapper)

    const selects = wrapper.findAllComponents(VSelect)
    const estadoSelect = selects[3]
    await estadoSelect.vm.$emit('update:modelValue', 'inactive')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Baja Person')
    expect(wrapper.text()).not.toContain('Activa Person')
  })

  it('shows only active persons when the Estado filter is set to "active"', async () => {
    const activePerson = buildPerson({ id: 1, first_name: 'Activa Person', active: true })
    const bajaPerson = buildPerson({ id: 2, first_name: 'Baja Person', active: false })
    const wrapper = mountTable([activePerson, bajaPerson])
    await openFilterMenu(wrapper)

    const selects = wrapper.findAllComponents(VSelect)
    const estadoSelect = selects[3]
    await estadoSelect.vm.$emit('update:modelValue', 'active')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Activa Person')
    expect(wrapper.text()).not.toContain('Baja Person')
  })
})

const mixedPersons = () => [
  buildPerson({ id: 1, first_name: 'Becaria Uno', user_type: 'BEC_ACTIVE' }),
  buildPerson({ id: 2, first_name: 'Egresado Dos', user_type: 'BEC_INACTIVE' }),
]

const hasTipoHeader = (wrapper: ReturnType<typeof mountTable>) =>
  wrapper.findAll('th').some((th) => th.text().includes('Tipo'))

const headerText = (wrapper: ReturnType<typeof mountTable>) =>
  wrapper.find('.bg-grey-lighten-5').text()

const setTipo = async (wrapper: ReturnType<typeof mountTable>, value: string[]) => {
  await openFilterMenu(wrapper)
  await wrapper.findAllComponents(VSelect)[0].vm.$emit('update:modelValue', value)
  await wrapper.vm.$nextTick()
}

describe('UsersTable — Tipo multi-select (default: becarios + egresados)', () => {
  it('defaults the Tipo selection to both types and shows every becario and egresado', async () => {
    const wrapper = mountTable(mixedPersons())
    await openFilterMenu(wrapper)

    const tipo = wrapper.findAllComponents(VSelect)[0]
    expect(tipo.props('multiple')).toBe(true)
    expect(tipo.props('modelValue')).toEqual(['BEC_ACTIVE', 'BEC_INACTIVE'])
    expect(wrapper.text()).toContain('Becaria Uno')
    expect(wrapper.text()).toContain('Egresado Dos')
    expect(hasTipoHeader(wrapper)).toBe(true)
  })

  it('shows only egresados and hides the Tipo column when BEC_ACTIVE is deselected', async () => {
    const wrapper = mountTable(mixedPersons())
    await setTipo(wrapper, ['BEC_INACTIVE'])

    expect(wrapper.text()).toContain('Egresado Dos')
    expect(wrapper.text()).not.toContain('Becaria Uno')
    expect(hasTipoHeader(wrapper)).toBe(false)
  })

  it('shows only becarios and hides the Tipo column when BEC_INACTIVE is deselected', async () => {
    const wrapper = mountTable(mixedPersons())
    await setTipo(wrapper, ['BEC_ACTIVE'])

    expect(wrapper.text()).toContain('Becaria Uno')
    expect(wrapper.text()).not.toContain('Egresado Dos')
    expect(hasTipoHeader(wrapper)).toBe(false)
  })

  it('treats an empty selection as no type filter (shows everyone, Tipo column visible)', async () => {
    const wrapper = mountTable(mixedPersons())
    await setTipo(wrapper, [])

    expect(wrapper.text()).toContain('Becaria Uno')
    expect(wrapper.text()).toContain('Egresado Dos')
    expect(hasTipoHeader(wrapper)).toBe(true)
  })

  it('shows the matching header label for each selection', async () => {
    const wrapper = mountTable(mixedPersons())
    expect(headerText(wrapper)).toContain('Becarios y egresados')
    expect(headerText(wrapper)).not.toContain('Todas las personas')

    await setTipo(wrapper, ['BEC_ACTIVE'])
    expect(headerText(wrapper)).toContain('Becarios')
    expect(headerText(wrapper)).not.toContain('y egresados')

    await setTipo(wrapper, ['BEC_INACTIVE'])
    expect(headerText(wrapper)).toContain('Egresados')

    await setTipo(wrapper, [])
    expect(headerText(wrapper)).toContain('Becarios y egresados')
  })

  it('keeps the persona count chip in sync with the selection', async () => {
    const wrapper = mountTable(mixedPersons())
    expect(headerText(wrapper)).toContain('2 personas')

    await setTipo(wrapper, ['BEC_ACTIVE'])
    expect(headerText(wrapper)).toContain('1 persona')
  })
})

describe('UsersTable — Montos column (pending scholarship amounts)', () => {
  const pendingChip = (wrapper: ReturnType<typeof mountTable>) =>
    wrapper.findAllComponents(VChip).filter((c) => c.text() === 'Pendientes')

  it('renders the Montos header between Activo and the actions column', () => {
    const wrapper = mountTable([buildPerson()])
    const headers = wrapper.findAll('th').map((th) => th.text())
    const activo = headers.findIndex((h) => h.includes('Activo'))
    const montos = headers.findIndex((h) => h.includes('Montos'))
    expect(montos).toBe(activo + 1)
    expect(montos).toBe(headers.length - 2)
  })

  it('shows the warning "Pendientes" chip when amounts_configured is false', () => {
    const wrapper = mountTable([buildPerson({ amounts_configured: false })])
    const chips = pendingChip(wrapper)
    expect(chips).toHaveLength(1)
    expect(chips[0].props('color')).toBe('warning')
    expect(chips[0].props('variant')).toBe('tonal')
    expect(chips[0].props('size')).toBe('small')
    expect(chips[0].props('prependIcon')).toBe('mdi-alert-circle-outline')
  })

  it('shows the chip when amounts_configured is undefined', () => {
    const wrapper = mountTable([buildPerson()])
    expect(pendingChip(wrapper)).toHaveLength(1)
  })

  it('does not show the chip when amounts_configured is true', () => {
    const wrapper = mountTable([buildPerson({ amounts_configured: true })])
    expect(pendingChip(wrapper)).toHaveLength(0)
  })

  it('wraps the chip in a tooltip saying "Montos de beca sin configurar"', () => {
    const wrapper = mountTable([buildPerson({ amounts_configured: false })])
    const tooltip = wrapper
      .findAllComponents(VTooltip)
      .find((t) => t.props('text') === 'Montos de beca sin configurar')
    expect(tooltip).toBeTruthy()
  })
})
