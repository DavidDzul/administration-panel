// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import type {
  AttendanceDiscount,
  DefinitiveDiscount,
  OriginWithholding,
  RetentionBreakdown,
  RetentionLedgerEntry,
} from '@/interfaces/payment'
import RetentionBreakdownPanel from '@/components/pagos/RetentionBreakdownPanel.vue'

const vuetify = createVuetify()

// sdd/withholding-detail-display PR4 — purely presentational, receives the
// real `RetentionBreakdown` shape verified server-side in PR1/PR2 (see
// apply-progress). One test per kind, per design's testing strategy table:
// each kind must render ONLY its own fields, kind 2 must never render a
// currency-formatted amount anywhere in its section (the single most likely
// regression per design's own risk note), and the all-empty payload must
// show a clean empty state instead of a blank section.

const buildLedgerEntry = (overrides: Partial<RetentionLedgerEntry> = {}): RetentionLedgerEntry => ({
  payment_id: 10,
  withholding_id: 20,
  period_year: 2026,
  period_month: 3,
  withheld_amount: '1200.00',
  amount_applied_now: '600.00',
  remaining_amount: '600.00',
  cause: 'Documentación incompleta',
  withheld_at: '2026-03-05T00:00:00.000000Z',
  applied_at: '2026-04-10T00:00:00.000000Z',
  created_by: 'Ada Lovelace',
  ...overrides,
})

const buildOriginWithholding = (overrides: Partial<OriginWithholding> = {}): OriginWithholding => ({
  withholding_id: 30,
  period_year: 2026,
  period_month: 4,
  withheld_amount: '500.00',
  paid_amount: '0.00',
  remaining_amount: '500.00',
  status: 'PENDING',
  cause: 'Retardo reiterado',
  withheld_at: '2026-04-10T00:00:00.000000Z',
  created_by: 'Grace Hopper',
  ...overrides,
})

const buildAttendanceDiscount = (overrides: Partial<AttendanceDiscount> = {}): AttendanceDiscount => ({
  id: 1,
  discount_type: 'RETARDOS',
  discount_percentage: '10.00',
  description: 'Dos retardos en el mes.',
  created_at: '2026-04-10T00:00:00.000000Z',
  ...overrides,
})

const buildDefinitiveDiscount = (overrides: Partial<DefinitiveDiscount> = {}): DefinitiveDiscount => ({
  discount_amount: '300.00',
  discount_percentage: '25.00',
  resolution_cause: 'Bajo rendimiento académico',
  ...overrides,
})

const emptyRetentions: RetentionBreakdown = {
  ledger_applied: [],
  ledger_applied_total: '0.00',
  origin_withholding: null,
  attendance_discounts: [],
  definitive_discount: null,
}

const mountPanel = (retentions: RetentionBreakdown) =>
  mount(RetentionBreakdownPanel, {
    props: { retentions },
    global: { plugins: [vuetify] },
  })

describe('RetentionBreakdownPanel', () => {
  it('renders ledger_applied entries with month, cause, amounts and the running total (kind 1a)', () => {
    const wrapper = mountPanel({
      ...emptyRetentions,
      ledger_applied: [buildLedgerEntry()],
      ledger_applied_total: '600.00',
    })

    const section = wrapper.get('[data-testid="ledger-section"]')
    expect(section.text()).toContain('marzo 2026')
    expect(section.text()).toContain('Documentación incompleta')
    expect(section.text()).toContain('$1,200.00')
    expect(section.text()).toContain('$600.00')
    expect(section.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('Total aplicado en este pago')
    expect(wrapper.text()).toContain('$600.00')
  })

  it('shows a fallback cause when null instead of a blank field', () => {
    const wrapper = mountPanel({
      ...emptyRetentions,
      ledger_applied: [buildLedgerEntry({ cause: null })],
      ledger_applied_total: '600.00',
    })

    expect(wrapper.get('[data-testid="ledger-section"]').text()).toContain('Sin motivo especificado')
  })

  it('renders origin_withholding as a clearly separate section from ledger_applied when both are present', () => {
    const wrapper = mountPanel({
      ...emptyRetentions,
      ledger_applied: [buildLedgerEntry()],
      ledger_applied_total: '600.00',
      origin_withholding: buildOriginWithholding(),
    })

    const ledgerSection = wrapper.get('[data-testid="ledger-section"]')
    const originSection = wrapper.get('[data-testid="origin-withholding-section"]')

    expect(ledgerSection.text()).toContain('Meses liquidados en este pago')
    expect(originSection.text()).toContain('Retención generada')
    expect(originSection.text()).toContain('abril 2026')
    expect(originSection.text()).toContain('Grace Hopper')
    // The origin section must not be merged into the ledger list.
    expect(ledgerSection.text()).not.toContain('Grace Hopper')
  })

  it('renders attendance discounts with date, percentage and description, and NEVER a currency amount in that section (kind 2)', () => {
    const wrapper = mountPanel({
      ...emptyRetentions,
      attendance_discounts: [buildAttendanceDiscount()],
    })

    const section = wrapper.get('[data-testid="attendance-discounts-section"]')
    expect(section.text()).toContain('Retardos')
    expect(section.text()).toContain('10')
    expect(section.text()).toContain('Dos retardos en el mes.')
    expect(section.text()).toContain('sin monto retenido')
    // The single most likely regression: no currency-formatted amount, and
    // no bare "$" glyph, anywhere in the kind-2 subtree.
    expect(section.text()).not.toContain('$')
    expect(section.text()).not.toMatch(/MXN/)
  })

  it('renders the definitive discount with amount/percentage/cause, explicitly labeled as not payable later, and no date (kind 3)', () => {
    const wrapper = mountPanel({
      ...emptyRetentions,
      definitive_discount: buildDefinitiveDiscount(),
    })

    const section = wrapper.get('[data-testid="definitive-discount-section"]')
    expect(section.text()).toContain('$300.00')
    expect(section.text()).toContain('25.00')
    expect(section.text()).toContain('Bajo rendimiento académico')
    expect(section.text()).toContain('no se pagará más adelante')
  })

  it('shows a clean empty state, not a blank section, when all four sub-keys are empty/null', () => {
    const wrapper = mountPanel(emptyRetentions)

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ledger-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="origin-withholding-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="attendance-discounts-section"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="definitive-discount-section"]').exists()).toBe(false)
  })
})
