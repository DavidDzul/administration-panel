// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import type { Bank } from '@/interfaces/bank'

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

const { mockAxiosGet, mockAxiosPost, mockAxiosPut, mockAxiosDelete } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
  mockAxiosPut: vi.fn(),
  mockAxiosDelete: vi.fn(),
}))
vi.mock('@/axiosConfig', () => ({
  default: { get: mockAxiosGet, post: mockAxiosPost, put: mockAxiosPut, delete: mockAxiosDelete },
}))

import BanksView from '@/views/bancos/BanksView.vue'
import { useAuthStore } from '@/stores/api/authStore'
import { useAlertStore } from '@/stores/alert'

const vuetify = createVuetify()

const buildBank = (overrides: Partial<Bank> = {}): Bank => ({
  id: 2,
  code: '014',
  name: 'Santander',
  is_active: true,
  is_system: false,
  ...overrides,
})

const bbva = buildBank({ id: 1, code: '012', name: 'BBVA', is_system: true })

const mountView = () => mount(BanksView, { global: { plugins: [vuetify] } })
// The dialogs teleport their content to document.body.
const body = () => new DOMWrapper(document.body)

const setPermissions = (manage: boolean): void => {
  useAuthStore().permissions = manage ? ['ADM_READ_BANKS', 'ADM_MANAGE_BANKS'] : ['ADM_READ_BANKS']
}

// Dialog inputs in DOM order: code, then name.
const codeInput = () => body().findAll('input')[0]
const nameInput = () => body().findAll('input')[1]

const openCreateDialog = async (wrapper: ReturnType<typeof mountView>): Promise<void> => {
  const addBtn = wrapper.findAll('button').find((b) => b.text().includes('Agregar'))
  await addBtn!.trigger('click')
  await flushPromises()
}

describe('BanksView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    mockAxiosPut.mockReset()
    mockAxiosDelete.mockReset()
    mockAxiosGet.mockResolvedValue({ data: { res: true, banks: [bbva, buildBank()] } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('shows an error alert when the fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockAxiosGet.mockReset()
    mockAxiosGet.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
  })

  it('renders code, name and status columns for each bank', async () => {
    setPermissions(false)
    mockAxiosGet.mockResolvedValueOnce({
      data: { res: true, banks: [bbva, buildBank({ id: 3, code: '021', name: 'HSBC', is_active: false })] },
    })
    const wrapper = mountView()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('012')
    expect(text).toContain('BBVA')
    expect(text).toContain('Activo')
    expect(text).toContain('HSBC')
    expect(text).toContain('Inactivo')
  })

  it('hides "Agregar" and row actions without ADM_MANAGE_BANKS', async () => {
    setPermissions(false)
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Agregar')
    expect(wrapper.find('[data-test="edit-bank"]').exists()).toBe(false)
  })

  it('creates a bank through the dialog with ADM_MANAGE_BANKS', async () => {
    setPermissions(true)
    const created = buildBank({ id: 9, code: '999', name: 'Nuevo Banco' })
    mockAxiosPost.mockResolvedValueOnce({ data: { res: true, bank: created } })
    const wrapper = mountView()
    await flushPromises()
    await openCreateDialog(wrapper)

    await codeInput().setValue('999')
    await nameInput().setValue('Nuevo Banco')
    await body().find('form').trigger('submit')
    await flushPromises()

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/banks', {
      code: '999',
      name: 'Nuevo Banco',
      is_active: true,
    })
    expect(wrapper.text()).toContain('Nuevo Banco')
  })

  it('blocks submit with Spanish messages when code or name are invalid', async () => {
    setPermissions(true)
    const wrapper = mountView()
    await flushPromises()
    await openCreateDialog(wrapper)

    await codeInput().setValue('12')
    await body().find('form').trigger('submit')
    await flushPromises()

    expect(mockAxiosPost).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('El código debe tener exactamente 3 dígitos.')
    expect(document.body.textContent).toContain('El nombre es obligatorio.')
  })

  it('surfaces a server 422 field error on the form', async () => {
    setPermissions(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockAxiosPost.mockRejectedValueOnce({
      response: { data: { errors: { code: ['El código ya está registrado.'] } } },
    })
    const wrapper = mountView()
    await flushPromises()
    await openCreateDialog(wrapper)

    await codeInput().setValue('014')
    await nameInput().setValue('Otro')
    await body().find('form').trigger('submit')
    await flushPromises()

    expect(document.body.textContent).toContain('El código ya está registrado.')
  })

  it('locks the BBVA row: deactivate and delete are disabled, edit stays enabled', async () => {
    setPermissions(true)
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, banks: [bbva] } })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-test="toggle-bank"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="delete-bank"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="edit-bank"]').attributes('disabled')).toBeUndefined()
  })

  it('deactivates an active bank through the update endpoint', async () => {
    setPermissions(true)
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, banks: [buildBank()] } })
    mockAxiosPut.mockResolvedValueOnce({ data: { res: true, bank: buildBank({ is_active: false }) } })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-test="toggle-bank"]').trigger('click')
    await flushPromises()

    expect(mockAxiosPut).toHaveBeenCalledWith('api/admin/banks/2', {
      code: '014',
      name: 'Santander',
      is_active: false,
    })
    expect(wrapper.text()).toContain('Inactivo')
  })

  it('shows the API message when deleting a referenced bank deactivates it instead', async () => {
    setPermissions(true)
    const msg = 'El banco está en uso, por lo que se desactivó en lugar de eliminarse.'
    mockAxiosGet.mockResolvedValueOnce({ data: { res: true, banks: [buildBank()] } })
    mockAxiosDelete.mockResolvedValueOnce({
      data: { res: true, deleted: false, msg, bank: buildBank({ is_active: false }) },
    })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('[data-test="delete-bank"]').trigger('click')
    await flushPromises()
    await body().find('[data-test="confirm-delete-bank"]').trigger('click')
    await flushPromises()

    expect(mockAxiosDelete).toHaveBeenCalledWith('api/admin/banks/2')
    expect(useAlertStore().config.title).toBe(msg)
    expect(wrapper.text()).toContain('Inactivo')
  })
})
