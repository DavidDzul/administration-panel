// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTextField } from 'vuetify/components'
import type { AdministrationRole } from '@/interfaces/role'

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

import { useRolesStore } from '@/stores/api/rolesStore'
import { useAlertStore } from '@/stores/alert'
import CreateRoleDialog from '@/components/roles/CreateRoleDialog.vue'

const buildRole = (overrides: Partial<AdministrationRole> = {}): AdministrationRole => ({
  id: 2,
  name: 'SOPORTE',
  permissions: [],
  ...overrides,
})

const mountDialog = (props: { modelValue: boolean }) =>
  mount(CreateRoleDialog, {
    props,
    global: { plugins: [vuetify] },
  })

// v-dialog content teleports to `document.body`, same gotcha as
// PaymentDataDialog.test.ts.
const body = () => new DOMWrapper(document.body)

const fieldByLabelPrefix = (wrapper: ReturnType<typeof mountDialog>, label: string) =>
  wrapper.findAllComponents(VTextField).find((f) => (f.props('label') as string | undefined)?.startsWith(label))

const submitForm = async (): Promise<void> => {
  await body().find('form').trigger('submit')
}

describe('CreateRoleDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not submit and does not call createRole when the name is empty', async () => {
    const rolesStore = useRolesStore()
    const createSpy = vi.spyOn(rolesStore, 'createRole')

    mountDialog({ modelValue: true })
    await flushPromises()

    await submitForm()
    await flushPromises()

    expect(createSpy).not.toHaveBeenCalled()
  })

  it('rejects a name longer than 255 characters', async () => {
    const rolesStore = useRolesStore()
    const createSpy = vi.spyOn(rolesStore, 'createRole')

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Nombre')?.setValue('A'.repeat(256))
    await submitForm()
    await flushPromises()

    expect(createSpy).not.toHaveBeenCalled()
    expect(body().text()).toContain('255 caracteres')
  })

  it('calls createRole with the entered name and emits created on success', async () => {
    const rolesStore = useRolesStore()
    const created = buildRole({ name: 'SOPORTE' })
    vi.spyOn(rolesStore, 'createRole').mockResolvedValue(created)

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Nombre')?.setValue('SOPORTE')
    await submitForm()
    await flushPromises()

    expect(rolesStore.createRole).toHaveBeenCalledWith('SOPORTE')
    expect(wrapper.emitted('created')).toHaveLength(1)
    expect(wrapper.emitted('created')?.[0]).toEqual([created])
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
  })

  it('shows an error alert and does not close the dialog when createRole fails (duplicate name)', async () => {
    const rolesStore = useRolesStore()
    const error = {
      response: { status: 422, data: { res: false, errors: { name: ['El nombre ya existe.'] } } },
    }
    vi.spyOn(rolesStore, 'createRole').mockRejectedValue(error)

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Nombre')?.setValue('DUPLICADO')
    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.show).toBe(true)
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toContain('El nombre ya existe.')
    expect(wrapper.emitted('created')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('shows a generic error alert when createRole fails without a field-specific message', async () => {
    const rolesStore = useRolesStore()
    vi.spyOn(rolesStore, 'createRole').mockRejectedValue(new Error('network error'))

    const wrapper = mountDialog({ modelValue: true })
    await flushPromises()

    await fieldByLabelPrefix(wrapper, 'Nombre')?.setValue('SOPORTE')
    await submitForm()
    await flushPromises()

    const alertStore = useAlertStore()
    expect(alertStore.config.status).toBe('error')
    expect(alertStore.config.title).toBe('Error al crear el rol, intenta nuevamente.')
    expect(wrapper.emitted('created')).toBeUndefined()
  })
})
