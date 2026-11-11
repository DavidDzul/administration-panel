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
  total_to_pay: '1000.00',
  concept_split: { beca: '800.00', apoyo: '200.00' },
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
const concept = (wrapper: ReturnType<typeof mountDialog>, name: 'Beca' | 'Apoyo') =>
  wrapper.findAllComponents(VTextField).find((f) => (f.props('label') as string).includes(`· ${name} (`))
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
    expect(text).toContain('$1,000.00')
  })

  it('shows the beneficiary when present', () => {
    mountDialog({ row: { ...row, cheque_beneficiary: 'María Lovelace' } })
    expect(body().text()).toContain('A nombre de: María Lovelace')
  })

  it('shows one cheque number field per concept with amount', () => {
    const wrapper = mountDialog()
    expect(concept(wrapper, 'Beca')?.props('label')).toContain('$800.00')
    expect(concept(wrapper, 'Apoyo')?.props('label')).toContain('$200.00')
  })

  it('shows no field for a zero concept', () => {
    const wrapper = mountDialog({ row: { ...row, concept_split: { beca: '1000.00', apoyo: '0.00' } } })
    expect(concept(wrapper, 'Beca')).toBeDefined()
    expect(concept(wrapper, 'Apoyo')).toBeUndefined()
  })

  it('defaults the delivery date to today with max today', () => {
    const wrapper = mountDialog()
    const date = field(wrapper, 'Fecha de entrega')
    expect(date?.props('modelValue')).toBe(todayYmd())
    expect(body().find('input[type="date"]').attributes('max')).toBe(todayYmd())
  })

  it('does not submit when a cheque number is empty', async () => {
    const wrapper = mountDialog()
    await concept(wrapper, 'Beca')?.setValue('CH-1')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('does not submit when beca and apoyo numbers are equal', async () => {
    const wrapper = mountDialog()
    await concept(wrapper, 'Beca')?.setValue('CH-1')
    await concept(wrapper, 'Apoyo')?.setValue(' ch-1 ')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('rejects a future delivery date', async () => {
    const wrapper = mountDialog()
    await concept(wrapper, 'Beca')?.setValue('CH-1')
    await concept(wrapper, 'Apoyo')?.setValue('CH-2')
    await field(wrapper, 'Fecha de entrega')?.setValue('2999-01-01')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits both references and the frozen expected amounts in one payload', async () => {
    const wrapper = mountDialog()
    await concept(wrapper, 'Beca')?.setValue(' CH-100 ')
    await concept(wrapper, 'Apoyo')?.setValue('CH-101')
    await notes(wrapper)?.setValue('Entregado en ventanilla')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      {
        references: { beca: 'CH-100', apoyo: 'CH-101' },
        expected_amounts: { beca: '800.00', apoyo: '200.00' },
        paid_at: todayYmd(),
        notes: 'Entregado en ventanilla',
      },
    ])
  })

  it('sends only the concept with amount and omits empty notes', async () => {
    const wrapper = mountDialog({ row: { ...row, concept_split: { beca: '1000.00', apoyo: '0.00' } } })
    await concept(wrapper, 'Beca')?.setValue('CH-2')
    await clickButton('Registrar pago')
    const payload = wrapper.emitted('submit')?.[0]?.[0] as Record<string, unknown>
    expect(payload.references).toEqual({ beca: 'CH-2' })
    expect(payload.expected_amounts).toEqual({ beca: '1000.00', apoyo: '0.00' })
    expect(payload.notes).toBeUndefined()
  })

  it('shows server field errors inline under the matching fields', () => {
    const wrapper = mountDialog({
      serverErrors: {
        'references.beca': ['Ese número de cheque ya fue registrado.'],
        notes: ['Notas inválidas'],
      },
    })
    const text = body().text()
    expect(concept(wrapper, 'Beca')?.props('errorMessages')).toEqual(['Ese número de cheque ya fue registrado.'])
    expect(text).toContain('Notas inválidas')
  })

  it('shows a form-level server error (e.g. split changed) in an alert', () => {
    mountDialog({ serverErrors: { form: ['Los montos cambiaron. Recarga el lote e inténtalo de nuevo.'] } })
    expect(body().find('[data-testid="cheque-dialog-form-error"]').text()).toContain('Recarga el lote')
  })

  it('emits update:modelValue false on Cancelar', async () => {
    const wrapper = mountDialog()
    await clickButton('Cancelar')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('resets the form when reopened', async () => {
    const wrapper = mountDialog()
    await concept(wrapper, 'Beca')?.setValue('CH-5')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(concept(wrapper, 'Beca')?.props('modelValue')).toBe('')
  })

  it('shows the loading state on the submit button while saving', () => {
    mountDialog({ saving: true })
    const btn = body()
      .findAll('button')
      .find((b) => b.text().includes('Registrar pago'))
    expect(btn?.classes()).toContain('v-btn--loading')
  })
})
