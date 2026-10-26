// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VTextField, VTextarea } from 'vuetify/components'
import type { ChequeRow } from '@/interfaces/payment'

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

import ChequePaymentDialog from '@/components/pagos/ChequePaymentDialog.vue'

const vuetify = createVuetify()
const body = () => new DOMWrapper(document.body)

const row = {
  refrend_id: 9,
  snapshot_name: 'Ada Lovelace',
  total_to_pay: '1500.00',
  cheque_beneficiary: null,
} as ChequeRow

const todayYmd = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const mountDialog = (props: Record<string, unknown> = {}) =>
  mount(ChequePaymentDialog, {
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

describe('ChequePaymentDialog', () => {
  it('shows title, becario name, beneficiary fallback and amount', () => {
    mountDialog()
    const text = body().text()
    expect(text).toContain('Registrar pago con cheque')
    expect(text).toContain('Ada Lovelace')
    expect(text).toContain('A nombre de: Ada Lovelace')
    expect(text).toContain('$1,500.00')
  })

  it('shows the beneficiary when present', () => {
    mountDialog({ row: { ...row, cheque_beneficiary: 'María Lovelace' } })
    expect(body().text()).toContain('A nombre de: María Lovelace')
  })

  it('defaults the delivery date to today with max today', () => {
    const wrapper = mountDialog()
    const date = field(wrapper, 'Fecha de entrega')
    expect(date?.props('modelValue')).toBe(todayYmd())
    expect(body().find('input[type="date"]').attributes('max')).toBe(todayYmd())
  })

  it('does not submit when the cheque number is empty', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('rejects a cheque number longer than 50 chars', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Número de cheque')?.setValue('x'.repeat(51))
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('rejects a future delivery date', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Número de cheque')?.setValue('CH-1')
    await field(wrapper, 'Fecha de entrega')?.setValue('2999-01-01')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits submit with the trimmed payload', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Número de cheque')?.setValue(' CH-100 ')
    await notes(wrapper)?.setValue('Entregado en ventanilla')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { cheque_number: 'CH-100', cheque_delivered_at: todayYmd(), cheque_notes: 'Entregado en ventanilla' },
    ])
  })

  it('omits empty notes from the payload', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Número de cheque')?.setValue('CH-2')
    await clickButton('Registrar pago')
    const payload = wrapper.emitted('submit')?.[0]?.[0] as Record<string, unknown>
    expect(payload.cheque_number).toBe('CH-2')
    expect(payload.cheque_notes).toBeUndefined()
  })

  it('shows server field errors inline under the matching fields', () => {
    mountDialog({
      serverErrors: { cheque_number: ['Ese número de cheque ya fue registrado.'], cheque_notes: ['Notas inválidas'] },
    })
    const text = body().text()
    expect(text).toContain('Ese número de cheque ya fue registrado.')
    expect(text).toContain('Notas inválidas')
  })

  it('emits update:modelValue false on Cancelar', async () => {
    const wrapper = mountDialog()
    await clickButton('Cancelar')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('resets the form when reopened', async () => {
    const wrapper = mountDialog()
    await field(wrapper, 'Número de cheque')?.setValue('CH-5')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(field(wrapper, 'Número de cheque')?.props('modelValue')).toBe('')
  })

  it('shows the loading state on the submit button while saving', () => {
    mountDialog({ saving: true })
    const btn = body()
      .findAll('button')
      .find((b) => b.text().includes('Registrar pago'))
    expect(btn?.classes()).toContain('v-btn--loading')
  })
})
