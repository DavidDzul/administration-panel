// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import type { AdvancePaymentDocumentInfo } from '@/interfaces/payment'
import AdvancePaymentPanel from '@/components/pagos/AdvancePaymentPanel.vue'

const vuetify = createVuetify()

// sdd/pago-adelantado — purely presentational, receives the real
// AdvancePaymentDocumentInfo shape from AdvancePaymentDocumentContext::forRefrend().
// One test per direction (settled_as_advance / has_registered_batch), one
// for both at once, one for the empty state, and one specifically locking
// in that the divergence reason renders when present.

const buildInfo = (overrides: Partial<AdvancePaymentDocumentInfo> = {}): AdvancePaymentDocumentInfo => ({
  settled_as_advance: false,
  origin_period_year: null,
  origin_period_month: null,
  settled_amount: null,
  settled_status: null,
  settled_resolution_type: null,
  divergence_reason: null,
  reached_at: null,
  has_registered_batch: false,
  registered_months_count: null,
  registered_total_amount: null,
  registered_cause: null,
  registered_notes: null,
  ...overrides,
})

const mountPanel = (advancePayment: AdvancePaymentDocumentInfo) =>
  mount(AdvancePaymentPanel, {
    props: { advancePayment },
    global: { plugins: [vuetify] },
  })

describe('AdvancePaymentPanel', () => {
  it('shows the empty state when neither direction is present', () => {
    const wrapper = mountPanel(buildInfo())

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="settled-as-advance-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="registered-batch-section"]').exists()).toBe(false)
  })

  it('renders the settled-as-advance section with origin month/year and amount, pending status', () => {
    const wrapper = mountPanel(
      buildInfo({
        settled_as_advance: true,
        origin_period_year: 2026,
        origin_period_month: 9,
        settled_amount: '1200.00',
        settled_status: 'PENDING',
      }),
    )

    const section = wrapper.find('[data-testid="settled-as-advance-section"]')
    expect(section.exists()).toBe(true)
    expect(section.text()).toContain('septiembre 2026')
    expect(section.text()).toContain('$1,200.00')
    expect(section.text()).toContain('Aún no se resuelve')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('renders the resolution and divergence reason once the month has been reconciled', () => {
    const wrapper = mountPanel(
      buildInfo({
        settled_as_advance: true,
        origin_period_year: 2026,
        origin_period_month: 9,
        settled_amount: '1200.00',
        settled_status: 'OVERRIDDEN',
        settled_resolution_type: 'BECA_MES',
        divergence_reason: 'Autorizado por dirección.',
        reached_at: '2027-06-15T00:00:00.000000Z',
      }),
    )

    const section = wrapper.find('[data-testid="settled-as-advance-section"]')
    expect(section.text()).toContain('BECA_MES')
    expect(section.text()).toContain('Autorizado por dirección.')
    expect(section.text()).not.toContain('Aún no se resuelve')
  })

  it('renders the registered-batch section with months count, total, and cause', () => {
    const wrapper = mountPanel(
      buildInfo({
        has_registered_batch: true,
        registered_months_count: 3,
        registered_total_amount: '3600.00',
        registered_cause: 'Solicitud del becario.',
      }),
    )

    const section = wrapper.find('[data-testid="registered-batch-section"]')
    expect(section.exists()).toBe(true)
    expect(section.text()).toContain('3')
    expect(section.text()).toContain('$3,600.00')
    expect(section.text()).toContain('Solicitud del becario.')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('renders both sections at once without one displacing the other', () => {
    const wrapper = mountPanel(
      buildInfo({
        settled_as_advance: true,
        origin_period_year: 2026,
        origin_period_month: 9,
        settled_amount: '1200.00',
        settled_status: 'REACHED',
        has_registered_batch: true,
        registered_months_count: 2,
        registered_total_amount: '2400.00',
      }),
    )

    expect(wrapper.find('[data-testid="settled-as-advance-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="registered-batch-section"]').exists()).toBe(true)
  })

  // sdd/revertir-pago-adelantado S12 — cycle-cut cancellation branches.
  describe('cycle-cut cancellation', () => {
    const cutRefrend = { id: 9, period_year: 2026, period_month: 4 }

    it('S40: a CANCELLED settled month shows a cancelled label, never "Sin especificar"', () => {
      const wrapper = mountPanel(
        buildInfo({
          settled_as_advance: true,
          origin_period_year: 2026,
          origin_period_month: 2,
          settled_amount: '5000.00',
          settled_status: 'CANCELLED',
          settled_header_status: 'PARTIALLY_CANCELLED',
          settled_cancelled_at: '2026-04-10T15:00:00.000000Z',
          settled_cancel_reason: 'BAJA_DEFINITIVA',
          settled_cancelled_cut_refrend: cutRefrend,
        }),
      )

      const section = wrapper.find('[data-testid="settled-as-advance-section"]')
      expect(section.text()).toContain('Cancelado por baja definitiva del 04/2026')
      expect(section.text()).toContain('10/4/2026')
      expect(section.text()).not.toContain('Sin especificar')
      expect(section.text()).not.toContain('Resuelto como')
      expect(section.text()).not.toContain('Aún no se resuelve')
    })

    it('labels an egreso cancellation of a settled month', () => {
      const wrapper = mountPanel(
        buildInfo({
          settled_as_advance: true,
          origin_period_year: 2026,
          origin_period_month: 2,
          settled_amount: '5000.00',
          settled_status: 'CANCELLED',
          settled_cancel_reason: 'EGRESADO',
          settled_cancelled_cut_refrend: cutRefrend,
        }),
      )

      const section = wrapper.find('[data-testid="settled-as-advance-section"]')
      expect(section.text()).toContain('Cancelado por egreso del 04/2026')
      expect(section.text()).not.toContain('Sin especificar')
    })

    it('still shows a cancelled label when the cut refrend is missing', () => {
      const wrapper = mountPanel(
        buildInfo({ settled_as_advance: true, settled_status: 'CANCELLED', settled_amount: '5000.00' }),
      )

      const section = wrapper.find('[data-testid="settled-as-advance-section"]')
      expect(section.text()).toContain('Cancelado')
      expect(section.text()).not.toContain('Sin especificar')
    })

    it('shows the cancellation, cancelled amount and cut period on a cancelled registered batch', () => {
      const wrapper = mountPanel(
        buildInfo({
          has_registered_batch: true,
          registered_months_count: 3,
          registered_total_amount: '15000.00',
          registered_status: 'PARTIALLY_CANCELLED',
          registered_cancelled_at: '2026-04-10T15:00:00.000000Z',
          registered_cancel_reason: 'EGRESADO',
          registered_cancelled_cut_refrend: cutRefrend,
          registered_cancelled_amount: '10000.00',
          registered_overpaid_amount: '0.00',
        }),
      )

      const section = wrapper.find('[data-testid="registered-batch-section"]')
      const cancelled = section.find('[data-testid="registered-cancellation"]')
      expect(cancelled.exists()).toBe(true)
      expect(cancelled.text()).toContain('Cancelado parcialmente por egreso del 04/2026')
      expect(cancelled.text()).toContain('10/4/2026')
      expect(cancelled.text()).toContain('$10,000.00')
    })

    it('labels a fully cancelled registered batch', () => {
      const wrapper = mountPanel(
        buildInfo({
          has_registered_batch: true,
          registered_status: 'CANCELLED',
          registered_cancel_reason: 'BAJA_DEFINITIVA',
          registered_cancelled_cut_refrend: cutRefrend,
          registered_cancelled_amount: '15000.00',
        }),
      )

      const cancelled = wrapper.find('[data-testid="registered-cancellation"]')
      expect(cancelled.text()).toContain('Cancelado por baja definitiva del 04/2026')
    })

    it('S39: shows the overpayment line when registered_overpaid_amount > 0', () => {
      const wrapper = mountPanel(
        buildInfo({
          has_registered_batch: true,
          registered_status: 'PARTIALLY_CANCELLED',
          registered_cancel_reason: 'BAJA_DEFINITIVA',
          registered_cancelled_cut_refrend: cutRefrend,
          registered_cancelled_amount: '10000.00',
          registered_overpaid_amount: '5000.00',
        }),
      )

      const line = wrapper.find('[data-testid="registered-overpayment"]')
      expect(line.exists()).toBe(true)
      expect(line.text()).toContain('Sobrepago por adelanto: $5,000.00')
    })

    it.each(['0.00', null])('S41: no overpayment line when overpaid is %s', (overpaid) => {
      const wrapper = mountPanel(
        buildInfo({
          has_registered_batch: true,
          registered_status: 'CANCELLED',
          registered_cancel_reason: 'BAJA_DEFINITIVA',
          registered_cancelled_cut_refrend: cutRefrend,
          registered_cancelled_amount: '15000.00',
          registered_overpaid_amount: overpaid,
        }),
      )

      expect(wrapper.find('[data-testid="registered-overpayment"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Sobrepago')
    })

    it('S41 regression: an ACTIVE batch renders exactly as before, with no cancellation or overpayment', () => {
      const wrapper = mountPanel(
        buildInfo({
          has_registered_batch: true,
          registered_months_count: 3,
          registered_total_amount: '3600.00',
          registered_cause: 'Solicitud del becario.',
          registered_status: 'ACTIVE',
          registered_cancelled_amount: '0.00',
          registered_overpaid_amount: '0.00',
        }),
      )

      expect(wrapper.find('[data-testid="registered-cancellation"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="registered-overpayment"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Cancelado')
    })

    it('S41 regression: a REACHED settled month renders as before', () => {
      const wrapper = mountPanel(
        buildInfo({
          settled_as_advance: true,
          origin_period_year: 2026,
          origin_period_month: 9,
          settled_amount: '1200.00',
          settled_status: 'REACHED',
          settled_resolution_type: null,
          settled_header_status: 'ACTIVE',
        }),
      )

      const section = wrapper.find('[data-testid="settled-as-advance-section"]')
      expect(section.text()).toContain('Resuelto como Sin especificar')
      expect(section.text()).not.toContain('Cancelado')
    })
  })
})
