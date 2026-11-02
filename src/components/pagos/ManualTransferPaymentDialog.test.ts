// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VTextField, VTextarea } from 'vuetify/components'
import type { ManualTransferRow } from '@/interfaces/payment'

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

import ManualTransferPaymentDialog from '@/components/pagos/ManualTransferPaymentDialog.vue'

const vuetify = createVuetify()
const body = () => new DOMWrapper(document.body)

const row = {
  refrend_id: 9,
  snapshot_name: 'Ada Lovelace',
  total_to_pay: '1500.00',
  bank_name: 'Banorte',
  account_number: '072180001234567895',
} as ManualTransferRow

const todayYmd = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const mountDialog = (props: Record<string, unknown> = {}) =>
  mount(ManualTransferPaymentDialog, {
    props: { modelValue: true, row, saving: false, serverErrors: {}, ...props },
    global: { plugins: [vuetify] },
  })

const field = (wrapper: ReturnType<typeof mountDialog>, label: string) =>
  wrapper.findAllComponents(VTextField).find((f) => (f.props('label') as string).startsWith(label))
const notes = (wrapper: ReturnType<typeof mountDialog>) => wrapper.findComponent(VTextarea)

const clickButton = async (text: string) => {
  await body()
    .findAll('button')
    .find((b) => b.text() === text)
    ?.trigger('click')
  await flushPromises()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ManualTransferPaymentDialog', () => {
  it('shows title, becario, bank, CLABE and amount', () => {
    mountDialog()
    const text = body().text()
    expect(text).toContain('Registrar transferencia a otro banco')
    expect(text).toContain('Ada Lovelace')
    expect(text).toContain('Banco: Banorte')
    expect(text).toContain('CLABE: 072180001234567895')
    expect(text).toContain('$1,500.00')
  })

  it('labels the reference as required and defaults the payment date to today', () => {
    const wrapper = mountDialog()
    expect(field(wrapper, 'Folio / referencia *')).toBeDefined()
    expect(field(wrapper, 'Fecha de pago')?.props('modelValue')).toBe(todayYmd())
    expect(body().find('input[type="date"]').attributes('max')).toBe(todayYmd())
  })

  it('does not submit when the reference is empty or blank and shows the Spanish message', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Folio / referencia')?.setValue('   ')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(body().text()).toContain('Captura el folio o la referencia de la transferencia.')
  })

  it('rejects a reference longer than 50 chars', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Folio / referencia')?.setValue('x'.repeat(51))
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('rejects a future payment date', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Folio / referencia')?.setValue('SPEI-1')
    await field(wrapper, 'Fecha de pago')?.setValue('2999-01-01')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits submit with the trimmed payload', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Folio / referencia')?.setValue(' SPEI-100 ')
    await notes(wrapper)?.setValue('Confirmado por el banco')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { transfer_reference: 'SPEI-100', transfer_paid_at: todayYmd(), transfer_notes: 'Confirmado por el banco' },
    ])
  })

  it('omits empty notes from the payload', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Folio / referencia')?.setValue('SPEI-2')
    await clickButton('Registrar pago')
    const payload = wrapper.emitted('submit')?.[0]?.[0] as Record<string, unknown>
    expect(payload.transfer_reference).toBe('SPEI-2')
    expect(payload.transfer_notes).toBeUndefined()
  })

  it('shows server field errors inline', () => {
    mountDialog({ serverErrors: { transfer_reference: ['Esa referencia de transferencia ya fue registrada.'] } })
    expect(body().text()).toContain('Esa referencia de transferencia ya fue registrada.')
  })

  it('emits update:modelValue false on Cancelar', async () => {
    const wrapper = mountDialog()
    await clickButton('Cancelar')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('resets the form when reopened', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Folio / referencia')?.setValue('SPEI-5')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(field(wrapper, 'Folio / referencia')?.props('modelValue')).toBe('')
  })

  it('shows the loading state on the submit button while saving', () => {
    mountDialog({ saving: true })
    const btn = body()
      .findAll('button')
      .find((b) => b.text().includes('Registrar pago'))
    expect(btn?.classes()).toContain('v-btn--loading')
  })
})
