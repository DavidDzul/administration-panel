// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { ref } from 'vue'
import type { Person } from '@/interfaces/user'
import type { Generation } from '@/interfaces/generation'
import type { SelectOption } from '@/constants'

// UsersTable renders a real VDataTable (pagination footer), which relies on
// ResizeObserver — same jsdom shim as UsersTable.test.ts.
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

const persons = ref<Person[]>([])
const generations = ref<Generation[]>([])
const filteredCampus = ref<SelectOption[]>([])
const loadingTable = ref(false)
const loadError = ref(false)
const canRead = ref(true)

vi.mock('@/composables/usePersonsPage', () => ({
  usePersonsPage: () => ({
    persons,
    generations,
    filteredCampus,
    loadingTable,
    loadError,
    canRead,
  }),
}))

import PersonsView from '@/views/users/PersonsView.vue'

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

const mountView = () => mount(PersonsView, { global: { plugins: [vuetify] } })

describe('PersonsView — smoke (loading / error / populated states)', () => {
  beforeEach(() => {
    persons.value = []
    generations.value = []
    filteredCampus.value = []
    loadingTable.value = false
    loadError.value = false
    canRead.value = true
  })

  it('renders the populated table without an error alert', () => {
    persons.value = [buildPerson()]
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('Ada')
  })

  it('passes the loading state through to the table while loadingTable is true', () => {
    loadingTable.value = true
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VDataTable' }).props('loading')).toBe(true)
  })

  it('shows an error alert instead of a silent blank table when loadError is true', () => {
    loadError.value = true
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
  })
})
