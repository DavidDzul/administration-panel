// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
import type { Administrator } from '@/interfaces/administrator'

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

import { useAdministratorsStore } from '@/stores/api/administratorsStore'
import { useAlertStore } from '@/stores/alert'
import CreateAccesoDialog from '@/components/accesos/CreateAccesoDialog.vue'

const buildAdministrator = (overrides: Partial<Administrator> = {}): Administrator => ({
  id: 3,
  first_name: 'Marie',
  last_name: 'Curie',
  email: 'marie@example.com',
  roles: [],
  ...overrides,
})

const mountDialog = (props: { modelValue: boolean }) =>
  mount(CreateAccesoDialog, {
    props,
    global: { plugins: [vuetify] },
  })

// v-dialog content teleports to `document.body`, same gotcha as
// CreateRoleDialog.test.ts.
const body = () => new DOMWrapper(document.body)

const fieldByLabelPrefix = (wrapper: ReturnType<typeof mountDialog>, label: string) =>
  wrapper.findAllComponents(VTextField).find((f) => (f.props('label') as string | undefined)?.startsWith(label))

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

const fillValidForm = async (wrapper: ReturnType<typeof mountDialog>): Promise<void> => {
  await fieldByLabelPrefix(wrapper, 'Nombre')?.setValue('Marie')
  await fieldByLabelPrefix(wrapper, 'Apellido')?.setValue('Curie')
  await fieldByLabelPrefix(wrapper, 'Correo')?.setValue('marie@example.com')
  await fieldByLabelPrefix(wrapper, 'Contraseña')?.setValue('supersecret')
}

describe('CreateAccesoDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not submit and does not call createAdministrator when required fields are empty', async () => {
    const administratorsStore = useAdministratorsStore()
    const createSpy = vi.spyOn(administratorsStore, 'createAdministrator')

    mountDialog({ modelValue: true })
    await flushPromises()

    await submitForm()
    await flushPromises()

    expect(createSpy).not.toHaveBeenCalled()
  })

  it('rejects an invalid email format', async () => {
    const administratorsStore = useAdministratorsStore()
    const createSpy = vi.spyOn(administratorsStore, 'createAdministrator')

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await fillValidForm(wrapper)
    await fieldByLabelPrefix(wrapper, 'Correo')?.setValue('not-an-email')
    await submitForm()
    await flushPromises()

    expect(createSpy).not.toHaveBeenCalled()
    expect(body().text()).toContain('inválido')
  })

  it('rejects a password shorter than 8 characters', async () => {
    const administratorsStore = useAdministratorsStore()
    const createSpy = vi.spyOn(administratorsStore, 'createAdministrator')

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await fillValidForm(wrapper)
    await fieldByLabelPrefix(wrapper, 'Contraseña')?.setValue('short')
    await submitForm()
    await flushPromises()

    expect(createSpy).not.toHaveBeenCalled()
    expect(body().text()).toContain('8 caracteres')
  })

  it('calls createAdministrator with the entered values and emits created on success', async () => {
    const administratorsStore = useAdministratorsStore()
    const created = buildAdministrator()
    vi.spyOn(administratorsStore, 'createAdministrator').mockResolvedValue(created)

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await fillValidForm(wrapper)
    await submitForm()
    await flushPromises()

    expect(administratorsStore.createAdministrator).toHaveBeenCalledWith({
      first_name: 'Marie',
      last_name: 'Curie',
      email: 'marie@example.com',
      password: 'supersecret',
    })
    expect(wrapper.emitted('created')).toHaveLength(1)
    expect(wrapper.emitted('created')?.[0]).toEqual([created])
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('shows an error alert and does not close the dialog when createAdministrator fails (duplicate email)', async () => {
    const administratorsStore = useAdministratorsStore()
    const error = {
      response: { status: 422, data: { res: false, errors: { email: ['El correo ya está registrado.'] } } },
    }
    vi.spyOn(administratorsStore, 'createAdministrator').mockRejectedValue(error)

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await fillValidForm(wrapper)
    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toContain('El correo ya está registrado.')
    expect(wrapper.emitted('created')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('shows a generic error alert when createAdministrator fails without a field-specific message', async () => {
    const administratorsStore = useAdministratorsStore()
    vi.spyOn(administratorsStore, 'createAdministrator').mockRejectedValue(new Error('network error'))

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await fillValidForm(wrapper)
    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('Error al crear el administrador, intenta nuevamente.')
    expect(wrapper.emitted('created')).toBeUndefined()
  })
})
