// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { ref } from 'vue'
import type { Person } from '@/interfaces/user'

// VProgressCircular relies on ResizeObserver — same jsdom shim as
// UsersTable.test.ts / PersonsView.test.ts.
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

const selectedPerson = ref<Person | null>(null)
const loading = ref(false)
const loadError = ref(false)
const canEdit = ref(false)

vi.mock('@/composables/usePersonDetailsPage', () => ({
  usePersonDetailsPage: () => ({
    selectedPerson,
    loading,
    loadError,
    canEdit,
  }),
}))

import PersonDetailsView from '@/views/users/PersonDetailsView.vue'

const vuetify = createVuetify()

const buildPerson = (overrides: Partial<Person> = {}): Person => ({
  id: 5,
  enrollment: 'A0005',
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

const mountView = () =>
  mount(PersonDetailsView, {
    global: {
      plugins: [vuetify],
    },
  })

describe('PersonDetailsView — smoke (loading / error / loaded states)', () => {
  beforeEach(() => {
    selectedPerson.value = null
    loading.value = false
    loadError.value = false
    canEdit.value = false
  })

  it('shows a loading indicator while loading is true, without rendering the identity header', () => {
    loading.value = true
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Ada')
  })

  it('shows an error alert instead of a silent blank page when loadError is true', () => {
    loadError.value = true
    const wrapper = mountView()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Ada')
  })

  it('renders the identity header when a person is loaded', () => {
    selectedPerson.value = buildPerson()
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Ada')
    expect(wrapper.text()).toContain('Lovelace')
    expect(wrapper.text()).toContain('A0005')
    expect(wrapper.text()).toContain('MERIDA')
    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false)
  })

  it('renders a single expansion panel and no calificaciones/documentos/historial panels (spec R6)', () => {
    selectedPerson.value = buildPerson()
    const wrapper = mountView()

    expect(wrapper.findAllComponents({ name: 'VExpansionPanel' })).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Calificaciones')
    expect(wrapper.text()).not.toContain('Documentos')
    expect(wrapper.text()).not.toContain('Historial')
  })
})
