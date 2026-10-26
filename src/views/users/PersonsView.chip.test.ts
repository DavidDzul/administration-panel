// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VChip } from 'vuetify/components'
import type { Person } from '@/interfaces/user'

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

const { mockAxiosGet } = vi.hoisted(() => ({ mockAxiosGet: vi.fn() }))
vi.mock('@/axiosConfig', () => ({ default: { get: mockAxiosGet } }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

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
  amounts_configured: false,
  ...overrides,
})

const DIALOG_STUB_TEMPLATE = `
  <div v-if="modelValue" class="dlg">
    <button class="save-config" @click="$emit('saved', { configSaved: true })">c</button>
    <button class="save-plain" @click="$emit('saved', { configSaved: false })">p</button>
    <button class="save-legacy" @click="$emit('saved')">l</button>
  </div>`

// Real usePersonsPage + real personsStore: only the HTTP layer is mocked, so
// the chip is driven by the store exactly as in production.
const mountView = async () => {
  mockAxiosGet.mockImplementation(async (url: string) => {
    if (url === 'api/admin/users') {
      return { data: { users: [buildPerson({ id: 1 }), buildPerson({ id: 2, first_name: 'Grace' })] } }
    }
    if (url === 'api/admin/graduates') return { data: { graduates: [] } }
    return { data: { generations: [] } }
  })
  const wrapper = mount(PersonsView, {
    global: {
      plugins: [vuetify],
      stubs: {
        PaymentDataDialog: {
          name: 'PaymentDataDialog',
          props: ['modelValue', 'userId', 'person'],
          emits: ['update:modelValue', 'saved'],
          template: DIALOG_STUB_TEMPLATE,
        },
      },
    },
  })
  await flushPromises()
  return wrapper
}

const chips = (wrapper: Awaited<ReturnType<typeof mountView>>) =>
  wrapper.findAllComponents(VChip).filter((c) => c.text() === 'Montos pendientes')

describe('PersonsView — pending amounts chip after saving', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    useAuthStore().permissions = ['ADM_EDIT_PAYMENT_DATA']
  })

  it('clears the chip only for the edited row when the config was saved', async () => {
    const wrapper = await mountView()
    expect(chips(wrapper)).toHaveLength(2)

    wrapper.findComponent(UsersTable).vm.$emit('edit', buildPerson({ id: 1 }))
    await wrapper.vm.$nextTick()
    await wrapper.find('.save-config').trigger('click')
    await flushPromises()

    expect(chips(wrapper)).toHaveLength(1)
  })

  it('keeps the chip when only payment data was saved', async () => {
    const wrapper = await mountView()

    wrapper.findComponent(UsersTable).vm.$emit('edit', buildPerson({ id: 1 }))
    await wrapper.vm.$nextTick()
    await wrapper.find('.save-plain').trigger('click')
    await flushPromises()

    expect(chips(wrapper)).toHaveLength(2)
  })

  it('tolerates a saved event without payload', async () => {
    const wrapper = await mountView()

    wrapper.findComponent(UsersTable).vm.$emit('edit', buildPerson({ id: 1 }))
    await wrapper.vm.$nextTick()
    await wrapper.find('.save-legacy').trigger('click')
    await flushPromises()

    expect(chips(wrapper)).toHaveLength(2)
  })
})
