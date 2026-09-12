// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
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

// authStore.ts calls `useRouter()` unconditionally in its setup — PersonsView
// now depends on authStore (editPaymentData), so this needs the same guard
// UsersTable.test.ts / authStore.test.ts already use.
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import PersonsView from '@/views/users/PersonsView.vue'
import UsersTable from '@/components/users/UsersTable.vue'
import { useAuthStore } from '@/stores/api/authStore'

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

// PaymentDataDialog performs its own store call on open (watch immediate) —
// stubbed here so this view's suite stays a lightweight wiring smoke test;
// PaymentDataDialog's own behavior is covered by PaymentDataDialog.test.ts.
const mountView = () =>
  mount(PersonsView, {
    global: {
      plugins: [vuetify],
      stubs: {
        PaymentDataDialog: {
          name: 'PaymentDataDialog',
          props: ['modelValue', 'userId'],
          emits: ['update:modelValue', 'saved'],
          template:
            '<div class="payment-data-dialog-stub" v-if="modelValue">{{ userId }}<button @click="$emit(\'saved\')">save</button></div>',
        },
      },
    },
  })

describe('PersonsView — smoke (loading / error / populated states)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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

// PR3b (sdd/becarios-payment-config): PersonsView hosts the SAME
// PaymentDataDialog used by PaymentDataCard (design D7) — one dialog, two
// entry points. This suite covers only the wiring: UsersTable's `edit` emit
// opens it with the right user id, and `@saved` closes it again.
describe('PersonsView — PaymentDataDialog wiring (PR3b)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    persons.value = [buildPerson({ id: 8 })]
    generations.value = []
    filteredCampus.value = []
    loadingTable.value = false
    loadError.value = false
    canRead.value = true
  })

  it('threads authStore.editPaymentData into UsersTable as canEdit', () => {
    const authStore = useAuthStore()
    authStore.permissions = ['ADM_EDIT_PAYMENT_DATA']

    const wrapper = mountView()
    const table = wrapper.findComponent(UsersTable)

    expect(table.props('canEdit')).toBe(true)
  })

  it('opens PaymentDataDialog with the edited person\'s id when UsersTable emits "edit"', async () => {
    const wrapper = mountView()
    const table = wrapper.findComponent(UsersTable)

    expect(wrapper.find('.payment-data-dialog-stub').exists()).toBe(false)

    table.vm.$emit('edit', buildPerson({ id: 8 }))
    await wrapper.vm.$nextTick()

    const dialogStub = wrapper.find('.payment-data-dialog-stub')
    expect(dialogStub.exists()).toBe(true)
    expect(dialogStub.text()).toContain('8')
  })

  it('closes the dialog when it emits "saved"', async () => {
    const wrapper = mountView()
    const table = wrapper.findComponent(UsersTable)

    table.vm.$emit('edit', buildPerson({ id: 8 }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.payment-data-dialog-stub').exists()).toBe(true)

    await wrapper.find('.payment-data-dialog-stub button').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.payment-data-dialog-stub').exists()).toBe(false)
  })
})
