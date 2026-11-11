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
  total_to_pay: '1000.00',
  concept_split: { beca: '800.00', apoyo: '200.00' },
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

describe('ManualTransferPaymentDialog', () => {
  it('shows title, becario, bank, CLABE and amount', () => {
    mountDialog()
    const text = body().text()
    expect(text).toContain('Registrar transferencia a otro banco')
    expect(text).toContain('Ada Lovelace')
    expect(text).toContain('Banco: Banorte')
    expect(text).toContain('CLABE: 072180001234567895')
    expect(text).toContain('$1,000.00')
  })

  it('shows one required reference field per concept with amount and defaults the payment date to today', () => {
    const wrapper = mountDialog()
    expect(concept(wrapper, 'Beca')?.props('label')).toContain('Folio / referencia')
    expect(concept(wrapper, 'Beca')?.props('label')).toContain('$800.00')
    expect(concept(wrapper, 'Apoyo')?.props('label')).toContain('$200.00')
    expect(field(wrapper, 'Fecha de pago')?.props('modelValue')).toBe(todayYmd())
    expect(body().find('input[type="date"]').attributes('max')).toBe(todayYmd())
  })

  it('shows no field for a zero concept', () => {
    const wrapper = mountDialog({ row: { ...row, concept_split: { beca: '0.00', apoyo: '1000.00' } } })
    expect(concept(wrapper, 'Beca')).toBeUndefined()
    expect(concept(wrapper, 'Apoyo')).toBeDefined()
  })

  it('does not submit when a reference is blank and shows the Spanish message', async () => {
    const wrapper = mountDialog()
    await concept(wrapper, 'Beca')?.setValue('SPEI-1')
    await concept(wrapper, 'Apoyo')?.setValue('   ')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(body().text()).toContain('Captura la referencia de este concepto.')
  })

  it('does not submit when both references are equal', async () => {
    const wrapper = mountDialog()
    await concept(wrapper, 'Beca')?.setValue('SPEI-1')
    await concept(wrapper, 'Apoyo')?.setValue('spei-1')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('rejects a future payment date', async () => {
    const wrapper = mountDialog()
    await concept(wrapper, 'Beca')?.setValue('SPEI-1')
    await concept(wrapper, 'Apoyo')?.setValue('SPEI-2')
    await field(wrapper, 'Fecha de pago')?.setValue('2999-01-01')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits both references and the expected amounts in one payload', async () => {
    const wrapper = mountDialog()
    await concept(wrapper, 'Beca')?.setValue(' SPEI-100 ')
    await concept(wrapper, 'Apoyo')?.setValue('SPEI-101')
    await notes(wrapper)?.setValue('Confirmado por el banco')
    await clickButton('Registrar pago')
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      {
        references: { beca: 'SPEI-100', apoyo: 'SPEI-101' },
        expected_amounts: { beca: '800.00', apoyo: '200.00' },
        paid_at: todayYmd(),
        notes: 'Confirmado por el banco',
      },
    ])
  })

  it('sends only the concept with amount and omits empty notes', async () => {
    const wrapper = mountDialog({ row: { ...row, concept_split: { beca: '0.00', apoyo: '1000.00' } } })
    await concept(wrapper, 'Apoyo')?.setValue('SPEI-2')
    await clickButton('Registrar pago')
    const payload = wrapper.emitted('submit')?.[0]?.[0] as Record<string, unknown>
    expect(payload.references).toEqual({ apoyo: 'SPEI-2' })
    expect(payload.expected_amounts).toEqual({ beca: '0.00', apoyo: '1000.00' })
    expect(payload.notes).toBeUndefined()
  })

  it('shows server field errors inline under the matching concept', () => {
    const wrapper = mountDialog({
      serverErrors: { 'references.apoyo': ['Esa referencia de transferencia ya fue registrada.'] },
    })
    expect(concept(wrapper, 'Apoyo')?.props('errorMessages')).toEqual([
      'Esa referencia de transferencia ya fue registrada.',
    ])
    expect(concept(wrapper, 'Beca')?.props('errorMessages')).toEqual([])
  })

  it('shows a form-level server error (e.g. split changed) in an alert', () => {
    mountDialog({ serverErrors: { form: ['Los montos cambiaron. Recarga el lote e inténtalo de nuevo.'] } })
    expect(body().find('[data-testid="manual-transfer-dialog-form-error"]').text()).toContain('Recarga el lote')
  })

  it('emits update:modelValue false on Cancelar', async () => {
    const wrapper = mountDialog()
    await clickButton('Cancelar')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('resets the form when reopened', async () => {
    const wrapper = mountDialog()
    await concept(wrapper, 'Beca')?.setValue('SPEI-5')
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
