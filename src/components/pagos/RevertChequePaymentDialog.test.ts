// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VTextarea } from 'vuetify/components'
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

import RevertChequePaymentDialog from '@/components/pagos/RevertChequePaymentDialog.vue'

const vuetify = createVuetify()
const body = () => new DOMWrapper(document.body)

const row = {
  refrend_id: 9,
  snapshot_name: 'Ada Lovelace',
  cheque_number: 'CH-77',
  cheque_delivered_at: '2026-10-05',
} as ChequeRow

const mountDialog = (props: Record<string, unknown> = {}) =>
  mount(RevertChequePaymentDialog, {
    props: { modelValue: true, row, saving: false, ...props },
    global: { plugins: [vuetify] },
  })

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

describe('RevertChequePaymentDialog', () => {
  it('shows title, becario, cheque number, date and the warning', () => {
    mountDialog()
    const text = body().text()
    expect(text).toContain('Revertir pago con cheque')
    expect(text).toContain('Ada Lovelace')
    expect(text).toContain('CH-77')
    expect(text).toContain('05/10/2026')
    expect(text).toContain('El refrendo volverá a quedar pendiente de pago.')
  })

  it('does not submit with an empty reason', async () => {
    const wrapper = mountDialog()
    await clickButton('Revertir pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('does not submit a reason shorter than 10 chars', async () => {
    const wrapper = mountDialog()
    await wrapper.findComponent(VTextarea).setValue('corto')
    await clickButton('Revertir pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('does not submit a reason longer than 500 chars', async () => {
    const wrapper = mountDialog()
    await wrapper.findComponent(VTextarea).setValue('x'.repeat(501))
    await clickButton('Revertir pago')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits submit with the trimmed reason', async () => {
    const wrapper = mountDialog()
    await wrapper.findComponent(VTextarea).setValue('  Cheque emitido por error  ')
    await clickButton('Revertir pago')
    expect(wrapper.emitted('submit')?.[0]).toEqual(['Cheque emitido por error'])
  })

  it('emits update:modelValue false on Cancelar', async () => {
    const wrapper = mountDialog()
    await clickButton('Cancelar')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('clears the reason when reopened', async () => {
    const wrapper = mountDialog()
    await wrapper.findComponent(VTextarea).setValue('Motivo suficientemente largo')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.findComponent(VTextarea).props('modelValue')).toBe('')
  })

  it('shows loading on the revert button while saving', () => {
    mountDialog({ saving: true })
    const btn = body()
      .findAll('button')
      .find((b) => b.text().includes('Revertir pago'))
    expect(btn?.classes()).toContain('v-btn--loading')
  })
})
