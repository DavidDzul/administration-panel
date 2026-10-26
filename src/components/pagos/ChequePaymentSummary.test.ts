// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import type { ChequeSummary } from '@/interfaces/payment'

if (!('visualViewport' in window)) {
  Object.defineProperty(window, 'visualViewport', { value: null, writable: true })
}

import ChequePaymentSummary from '@/components/pagos/ChequePaymentSummary.vue'

const vuetify = createVuetify()

const summary: ChequeSummary = {
  total: 3,
  ready: 1,
  paid: 1,
  blocking: 1,
  ready_amount: '1000.00',
  paid_amount: '2500.50',
}

describe('ChequePaymentSummary', () => {
  it('renders nothing without a summary', () => {
    const wrapper = mount(ChequePaymentSummary, { props: { summary: null }, global: { plugins: [vuetify] } })
    expect(wrapper.findAll('.payment-summary-card')).toHaveLength(0)
  })

  it('renders the six cards with labels, counts and MXN amounts', () => {
    const wrapper = mount(ChequePaymentSummary, { props: { summary }, global: { plugins: [vuetify] } })
    const cards = wrapper.findAll('.payment-summary-card').map((c) => c.text())
    expect(cards).toHaveLength(6)
    expect(cards[0]).toContain('Becarios con cheque')
    expect(cards[0]).toContain('3')
    expect(cards[1]).toContain('Por emitir')
    expect(cards[2]).toContain('Pagados')
    expect(cards[3]).toContain('Bloqueados')
    expect(cards[4]).toContain('Monto por emitir')
    expect(cards[4]).toContain('$1,000.00')
    expect(cards[5]).toContain('Monto pagado')
    expect(cards[5]).toContain('$2,500.50')
  })
})
