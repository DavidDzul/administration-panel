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
  ready_beca_amount: '700.00',
  ready_apoyo_amount: '300.00',
  paid_beca_amount: '2000.25',
  paid_apoyo_amount: '500.25',
}

describe('ChequePaymentSummary', () => {
  it('renders nothing without a summary', () => {
    const wrapper = mount(ChequePaymentSummary, { props: { summary: null }, global: { plugins: [vuetify] } })
    expect(wrapper.findAll('.payment-summary-card')).toHaveLength(0)
  })

  it('renders the ten cards with labels, counts and MXN amounts', () => {
    const wrapper = mount(ChequePaymentSummary, { props: { summary }, global: { plugins: [vuetify] } })
    const cards = wrapper.findAll('.payment-summary-card').map((c) => c.text())
    expect(cards).toHaveLength(10)
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

  it('uses transfer wording for the manual_transfer kind', () => {
    const wrapper = mount(ChequePaymentSummary, {
      props: { summary, kind: 'manual_transfer' },
      global: { plugins: [vuetify] },
    })
    const cards = wrapper.findAll('.payment-summary-card').map((c) => c.text())
    expect(cards).toHaveLength(10)
    expect(cards[0]).toContain('Becarios con transferencia')
    expect(cards[1]).toContain('Por pagar')
    expect(cards[4]).toContain('Monto por pagar')
    expect(cards[4]).toContain('$1,000.00')
    expect(cards[5]).toContain('Monto pagado')
  })

  it('shows the per-account Beca / Apoyo amounts for ready and paid', () => {
    const wrapper = mount(ChequePaymentSummary, { props: { summary }, global: { plugins: [vuetify] } })
    const cards = wrapper.findAll('.payment-summary-card').map((c) => c.text())
    expect(cards[6]).toContain('Monto por emitir · Cuenta Beca')
    expect(cards[6]).toContain('$700.00')
    expect(cards[7]).toContain('Monto por emitir · Cuenta Apoyo')
    expect(cards[7]).toContain('$300.00')
    expect(cards[8]).toContain('Monto pagado · Cuenta Beca')
    expect(cards[8]).toContain('$2,000.25')
    expect(cards[9]).toContain('Monto pagado · Cuenta Apoyo')
    expect(cards[9]).toContain('$500.25')
  })

  it('uses transfer wording on the per-account cards for manual_transfer', () => {
    const wrapper = mount(ChequePaymentSummary, {
      props: { summary, kind: 'manual_transfer' },
      global: { plugins: [vuetify] },
    })
    const cards = wrapper.findAll('.payment-summary-card').map((c) => c.text())
    expect(cards[6]).toContain('Monto por pagar · Cuenta Beca')
  })

  it('each Beca + Apoyo pair sums to its total amount', () => {
    const cents = (v: string): number => Math.round(Number(v) * 100)
    expect(cents(summary.ready_beca_amount) + cents(summary.ready_apoyo_amount)).toBe(cents(summary.ready_amount))
    expect(cents(summary.paid_beca_amount) + cents(summary.paid_apoyo_amount)).toBe(cents(summary.paid_amount))
  })
})
