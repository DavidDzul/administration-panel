// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VBtn } from 'vuetify/components'
import type { PaymentBatchRow } from '@/interfaces/payment'

// Same jsdom shim as PaymentsView.test.ts.
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

import PaymentBatchTable from '@/components/pagos/PaymentBatchTable.vue'

const vuetify = createVuetify()

const buildRow = (overrides: Partial<PaymentBatchRow> = {}): PaymentBatchRow => ({
  refrend_id: 1,
  user_id: 1,
  snapshot_name: 'Ada Lovelace',
  enrollment: 'A0001',
  bank_name: 'BBVA',
  account_number: '012180001234567895',
  total_to_pay: '1000.00',
  is_payable: true,
  blocking_reasons: [],
  outcome: null,
  outcome_reason: null,
  has_incident: false,
  has_pending_from_previous: false,
  only_pending_from_previous: false,
  resolution_type: null,
  resolution_cause: null,
  advance_paid: false,
  advance_paid_amount: null,
  advance_paid_origin_year: null,
  advance_paid_origin_month: null,
  advance_payment_amount: '0.00',
  advance_paid_divergence_reason: null,
  excluded_from_bank_file: false,
  snapshot_temporary_increase_amount: null,
  snapshot_temporary_increase_reason: null,
  snapshot_scholarship_type: 'IU',
  base_amount: '1000.00',
  snapshot_monto_apoyo: null,
  payment_batch_id: null,
  status: 'DRAFT',
  snapshot_generation: 'Generación 9',
  snapshot_generation_id: 9,
  snapshot_gross_amount: '1000.00',
  discount_percentage: '0',
  snapshot_discount_percentage: null,
  final_amount: '1000.00',
  amount_pending_from_previous: '0.00',
  refund_amount_from_previous: '0.00',
  ...overrides,
})

interface MountTableOptions {
  groupSourceRows?: PaymentBatchRow[]
  isPaid?: boolean
}

const mountTable = (rows: PaymentBatchRow[], options: MountTableOptions = {}) =>
  mount(PaymentBatchTable, {
    props: {
      rows,
      groupSourceRows: options.groupSourceRows ?? rows,
      isPaid: options.isPaid ?? false,
    },
    global: { plugins: [vuetify] },
  })

// Vuetify's native groupBy inserts a "group-header" row (rendered via our own
// #group-header slot, tagged data-testid="payment-group-header") ahead of
// each generación's rows. Every pre-existing positional `tbody tr`/`td`
// lookup in this file predates grouping and must skip those header rows —
// this helper is the single place that excludes them, so the ~22 existing
// `cells[cells.length - N]` assertions below keep working unchanged (they
// already index from the END of a row's own cells, which grouping doesn't
// affect).
const dataRows = (wrapper: ReturnType<typeof mountTable>) =>
  wrapper.findAll('tbody tr').filter((tr) => tr.attributes('data-testid') !== 'payment-group-header')

describe('PaymentBatchTable', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('does not render a "Matrícula" column header or the enrollment value', () => {
    const wrapper = mountTable([buildRow({ enrollment: 'A0001' })])

    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers).not.toContain('Matrícula')
    expect(wrapper.text()).not.toContain('A0001')
  })

  it('never renders the full account number, only the masked last 4 digits', () => {
    const wrapper = mountTable([buildRow({ account_number: '012180001234567895' })])

    expect(wrapper.text()).not.toContain('012180001234567895')
    expect(wrapper.text()).toContain('••••7895')
  })

  it('shows a clear placeholder when the becario has no account number on file', () => {
    const wrapper = mountTable([buildRow({ account_number: null })])

    expect(wrapper.text()).toContain('Sin cuenta')
  })

  it('shows an incidencia chip only for rows with has_incident=true', () => {
    const wrapper = mountTable([
      buildRow({ refrend_id: 1, snapshot_name: 'Ada Lovelace', has_incident: true }),
      buildRow({ refrend_id: 2, snapshot_name: 'Grace Hopper', has_incident: false }),
    ])

    expect(wrapper.text()).toContain('Incidencia registrada')

    const rows = dataRows(wrapper)
    expect(rows[0].text()).toContain('Incidencia registrada')
    expect(rows[1].text()).not.toContain('Incidencia registrada')
  })

  it('shows a "mes retenido" chip only for rows with has_pending_from_previous=true', () => {
    const wrapper = mountTable([
      buildRow({ refrend_id: 1, snapshot_name: 'Ada Lovelace', has_pending_from_previous: true }),
      buildRow({ refrend_id: 2, snapshot_name: 'Grace Hopper', has_pending_from_previous: false }),
    ])

    const rows = dataRows(wrapper)
    expect(rows[0].text()).toContain('Incluye mes retenido')
    expect(rows[1].text()).not.toContain('Incluye mes retenido')
  })

  it('says "Solo mes retenido" when the current month pays nothing, not "Incluye"', () => {
    const wrapper = mountTable([
      buildRow({ refrend_id: 1, has_pending_from_previous: true, only_pending_from_previous: true }),
    ])

    expect(wrapper.text()).toContain('Solo mes retenido')
    expect(wrapper.text()).not.toContain('Incluye mes retenido')
  })

  // ── Becario name opens the payment document (spec: "Becario name opens
  // the payment document") — the standalone "Ver" column/button is removed;
  // the name itself is now the trigger.

  it('removes the standalone "Ver" column entirely', () => {
    const wrapper = mountTable([buildRow({ refrend_id: 7 })])

    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers).not.toContain('Ver')
    expect(wrapper.findAllComponents(VBtn).some((b) => b.text() === 'Ver')).toBe(false)
  })

  it('renders the becario name as a native button styled as a link, with an explicit aria-label', () => {
    const wrapper = mountTable([buildRow({ refrend_id: 7, snapshot_name: 'Ada Lovelace' })])

    const nameButton = wrapper.find('button.payment-name-link')
    expect(nameButton.exists()).toBe(true)
    expect(nameButton.attributes('type')).toBe('button')
    expect(nameButton.attributes('aria-label')).toBe('Ver documento de pago de Ada Lovelace')
    expect(nameButton.text()).toBe('Ada Lovelace')
  })

  it('emits "view" with the refrend_id when the becario name is clicked', async () => {
    const wrapper = mountTable([buildRow({ refrend_id: 7 })])

    const nameButton = wrapper.find('button.payment-name-link')
    await nameButton.trigger('click')

    expect(wrapper.emitted('view')).toEqual([[7]])
  })

  // jsdom does not synthesize a click from Enter/Space the way a real browser
  // does for a native <button> (design's testing-strategy note) — so Enter/
  // Space keyboard activation is covered structurally: asserting the element
  // is a real `<button type="button">` (above) is what guarantees the
  // browser's built-in Enter/Space-triggers-click behavior applies here,
  // rather than attempting to fake that native behavior inside jsdom.
  it('is a real button element (not a div/span with a click handler), guaranteeing native Enter/Space activation', () => {
    const wrapper = mountTable([buildRow({ refrend_id: 8 })])

    const nameButton = wrapper.find('button.payment-name-link')
    expect(nameButton.element.tagName).toBe('BUTTON')
  })

  it('shows the blocking reasons in the "Motivo" column, not under the Estado chip', () => {
    const wrapper = mountTable([
      buildRow({
        refrend_id: 2,
        is_payable: false,
        blocking_reasons: [{ code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' }],
      }),
    ])

    const cells = dataRows(wrapper)[0].findAll('td')
    const estadoCell = cells[cells.length - 2]
    const motivoCell = cells[cells.length - 1]

    expect(estadoCell.text()).not.toContain('Sin matrícula registrada')
    expect(motivoCell.text()).toContain('Sin matrícula registrada')
  })

  it('shows a dash in "Motivo" for a payable row with nothing to report', () => {
    const wrapper = mountTable([buildRow({ refrend_id: 3, is_payable: true, blocking_reasons: [] })])

    const cells = dataRows(wrapper)[0].findAll('td')
    const motivoCell = cells[cells.length - 1]

    expect(motivoCell.text()).toBe('—')
  })

  it('does not style "Motivo" as an error when the only blocking reason is ALREADY_PAID', () => {
    const wrapper = mountTable([
      buildRow({
        refrend_id: 4,
        is_payable: false,
        blocking_reasons: [{ code: 'ALREADY_PAID', message: 'Pago ya realizado' }],
      }),
    ])

    const cells = dataRows(wrapper)[0].findAll('td')
    const motivoCell = cells[cells.length - 1]

    expect(motivoCell.text()).toContain('Pago ya realizado')
    expect(motivoCell.find('.text-error').exists()).toBe(false)
  })

  it('still styles "Motivo" as an error when ALREADY_PAID appears alongside a real blocking reason', () => {
    const wrapper = mountTable([
      buildRow({
        refrend_id: 5,
        is_payable: false,
        blocking_reasons: [
          { code: 'ALREADY_PAID', message: 'Pago ya realizado' },
          { code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' },
        ],
      }),
    ])

    const cells = dataRows(wrapper)[0].findAll('td')
    const motivoCell = cells[cells.length - 1]

    expect(motivoCell.find('.text-error').exists()).toBe(true)
  })

  // ── Resolution indicator chip (sdd/resolution-status-visibility) ─────────

  describe('resolution indicator chip', () => {
    it.each([
      ['RETENIDA', 'mdi-lock-outline', 'amber-darken-2', 'Beca retenida'],
      ['SIN_PAGO', 'mdi-cash-remove', 'red', 'Sin pago'],
      ['DESCUENTO_DEFINITIVO', 'mdi-cash-minus', 'purple-darken-2', 'Descuento definitivo'],
      // BECA_MES must chip too, not hide — user override of proposal D5.
      ['BECA_MES', 'mdi-cash-check', 'green', 'Pago sin penalización'],
    ])('renders the correct icon/color/aria-label for resolution_type=%s', (resolutionType, icon, color, label) => {
      const wrapper = mountTable([buildRow({ resolution_type: resolutionType, resolution_cause: null })])

      const chip = wrapper.find('[data-testid="resolution-chip"]')
      expect(chip.exists()).toBe(true)
      expect(chip.attributes('aria-label')).toBe(label)
      expect(chip.find('.v-icon').classes()).toContain(icon)
      expect(chip.classes().join(' ')).toContain(`text-${color}`)
    })

    it('shows the label as visible chip text, not only on hover', () => {
      const wrapper = mountTable([buildRow({ resolution_type: 'DESCUENTO_DEFINITIVO', resolution_cause: null })])

      const chip = wrapper.find('[data-testid="resolution-chip"]')
      expect(chip.text()).toContain('Descuento definitivo')
    })

    it('renders no resolution chip when resolution_type is null', () => {
      const wrapper = mountTable([buildRow({ resolution_type: null })])

      expect(wrapper.find('[data-testid="resolution-chip"]').exists()).toBe(false)
    })

    it('coexists with has_incident and has_pending_from_previous chips without displacing either', () => {
      const wrapper = mountTable([
        buildRow({
          has_incident: true,
          has_pending_from_previous: true,
          resolution_type: 'RETENIDA',
        }),
      ])

      expect(wrapper.text()).toContain('Incidencia registrada')
      expect(wrapper.text()).toContain('Incluye mes retenido')
      expect(wrapper.find('[data-testid="resolution-chip"]').exists()).toBe(true)
    })

    it('appends "· Motivo: {resolution_cause}" to the aria-label when resolution_cause is non-null', () => {
      const wrapper = mountTable([buildRow({ resolution_type: 'RETENIDA', resolution_cause: 'FALTAS_FI' })])

      const chip = wrapper.find('[data-testid="resolution-chip"]')
      expect(chip.attributes('aria-label')).toBe('Beca retenida · Motivo: FALTAS_FI')
    })

    it('aria-label is the label alone when resolution_cause is null', () => {
      const wrapper = mountTable([buildRow({ resolution_type: 'RETENIDA', resolution_cause: null })])

      const chip = wrapper.find('[data-testid="resolution-chip"]')
      expect(chip.attributes('aria-label')).toBe('Beca retenida')
    })
  })

  // ── Advance-paid indicator chip (sdd/pago-adelantado PR7b) ───────────────

  describe('advance-paid indicator chip', () => {
    it('renders no advance-paid chip when advance_paid is false', () => {
      const wrapper = mountTable([buildRow({ advance_paid: false })])

      expect(wrapper.find('[data-testid="advance-paid-chip"]').exists()).toBe(false)
    })

    it('renders the advance-paid chip with a visible label when advance_paid is true', () => {
      const wrapper = mountTable([
        buildRow({
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
        }),
      ])

      const chip = wrapper.find('[data-testid="advance-paid-chip"]')
      expect(chip.exists()).toBe(true)
      expect(chip.text()).toContain('Pago adelantado')
    })

    it('the aria-label/tooltip shows the amount and origin batch month/year', () => {
      const wrapper = mountTable([
        buildRow({
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
        }),
      ])

      const chip = wrapper.find('[data-testid="advance-paid-chip"]')
      expect(chip.attributes('aria-label')).toContain('junio 2027')
      expect(chip.attributes('aria-label')).toContain('$1,500.00')
    })

    it('uses an icon distinct from mdi-cash-clock (has_pending_from_previous chip)', () => {
      const wrapper = mountTable([
        buildRow({
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
        }),
      ])

      const chip = wrapper.find('[data-testid="advance-paid-chip"]')
      const iconClasses = chip.find('.v-icon').classes()
      expect(iconClasses).not.toContain('mdi-cash-clock')
    })

    it('coexists with has_incident, has_pending_from_previous, and resolution chips without displacing any', () => {
      const wrapper = mountTable([
        buildRow({
          has_incident: true,
          has_pending_from_previous: true,
          resolution_type: 'RETENIDA',
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
        }),
      ])

      expect(wrapper.text()).toContain('Incidencia registrada')
      expect(wrapper.text()).toContain('Incluye mes retenido')
      expect(wrapper.find('[data-testid="resolution-chip"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="advance-paid-chip"]').exists()).toBe(true)
    })

    it('never affects is_payable or the Estado/Motivo columns for a blocked, advance-paid row', () => {
      const wrapper = mountTable([
        buildRow({
          refrend_id: 9,
          is_payable: false,
          blocking_reasons: [{ code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' }],
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
        }),
      ])

      const cells = dataRows(wrapper)[0].findAll('td')
      const estadoCell = cells[cells.length - 2]
      const motivoCell = cells[cells.length - 1]

      expect(estadoCell.text()).toContain('Bloqueado')
      expect(motivoCell.text()).toContain('Sin matrícula registrada')
      expect(wrapper.find('[data-testid="advance-paid-chip"]').exists()).toBe(true)
    })
  })

  // ── Advance-payment-registered indicator chip (sdd/pago-adelantado PR8) ──
  //
  // OPPOSITE meaning from the advance-paid chip above: this chip means "this
  // row is an origin refrend — staff already recorded an advance-payment
  // batch FROM it", not "this row was settled by an advance batch made from
  // another refrend". Both chips may render on the same row simultaneously
  // in theory; this suite verifies they never displace one another.

  describe('advance-payment-registered indicator chip', () => {
    it('renders no chip when advance_payment_amount is "0.00"', () => {
      const wrapper = mountTable([buildRow({ advance_payment_amount: '0.00' })])

      expect(wrapper.find('[data-testid="advance-payment-registered-chip"]').exists()).toBe(false)
    })

    it('renders the chip with a visible label when advance_payment_amount is positive', () => {
      const wrapper = mountTable([buildRow({ advance_payment_amount: '750.50' })])

      const chip = wrapper.find('[data-testid="advance-payment-registered-chip"]')
      expect(chip.exists()).toBe(true)
      expect(chip.text()).toContain('Pago adelantado registrado')
    })

    it('the aria-label/tooltip shows the formatted amount', () => {
      const wrapper = mountTable([buildRow({ advance_payment_amount: '750.50' })])

      const chip = wrapper.find('[data-testid="advance-payment-registered-chip"]')
      expect(chip.attributes('aria-label')).toContain('$750.50')
    })

    it('uses an icon distinct from mdi-cash-clock and the advance-paid chip icon', () => {
      const wrapper = mountTable([
        buildRow({
          advance_payment_amount: '750.50',
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
        }),
      ])

      const registeredChip = wrapper.find('[data-testid="advance-payment-registered-chip"]')
      const registeredIconClasses = registeredChip.find('.v-icon').classes()
      expect(registeredIconClasses).not.toContain('mdi-cash-clock')

      const paidChip = wrapper.find('[data-testid="advance-paid-chip"]')
      const paidIconClasses = paidChip.find('.v-icon').classes()
      expect(registeredIconClasses.join(' ')).not.toBe(paidIconClasses.join(' '))
    })

    it('coexists with the advance-paid chip on the same row without displacing it (both can be true at once)', () => {
      const wrapper = mountTable([
        buildRow({
          advance_payment_amount: '750.50',
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
        }),
      ])

      expect(wrapper.find('[data-testid="advance-payment-registered-chip"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="advance-paid-chip"]').exists()).toBe(true)
    })

    it('never affects is_payable or the Estado/Motivo columns for a blocked row with an advance payment registered', () => {
      const wrapper = mountTable([
        buildRow({
          refrend_id: 11,
          is_payable: false,
          blocking_reasons: [{ code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' }],
          advance_payment_amount: '750.50',
        }),
      ])

      const cells = dataRows(wrapper)[0].findAll('td')
      const estadoCell = cells[cells.length - 2]
      const motivoCell = cells[cells.length - 1]

      expect(estadoCell.text()).toContain('Bloqueado')
      expect(motivoCell.text()).toContain('Sin matrícula registrada')
      expect(wrapper.find('[data-testid="advance-payment-registered-chip"]').exists()).toBe(true)
    })
  })

  // Divergence-reason indicator (added 2026-09-27, live user request): a
  // reviewer scanning the batch needs to see at a glance that staff overrode
  // the safe $0 outcome on an arrived advance-paid month, without opening
  // the "Ver" document.
  describe('advance-payment divergence-reason chip', () => {
    it('renders no chip when advance_paid is false, even with a divergence reason present', () => {
      const wrapper = mountTable([
        buildRow({ advance_paid: false, advance_paid_divergence_reason: 'Autorizado por dirección.' }),
      ])

      expect(wrapper.find('[data-testid="advance-payment-divergence-chip"]').exists()).toBe(false)
    })

    it('renders no chip when advance_paid is true but there is no divergence reason', () => {
      const wrapper = mountTable([
        buildRow({
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
          advance_paid_divergence_reason: null,
        }),
      ])

      expect(wrapper.find('[data-testid="advance-payment-divergence-chip"]').exists()).toBe(false)
    })

    it('renders the chip with the reason in the aria-label/tooltip when both conditions hold', () => {
      const wrapper = mountTable([
        buildRow({
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
          advance_paid_divergence_reason: 'Autorizado por dirección.',
        }),
      ])

      const chip = wrapper.find('[data-testid="advance-payment-divergence-chip"]')
      expect(chip.exists()).toBe(true)
      expect(chip.text()).toContain('Motivo registrado')
      expect(chip.attributes('aria-label')).toContain('Autorizado por dirección.')
    })

    it('coexists with the advance-paid chip on the same row without displacing it', () => {
      const wrapper = mountTable([
        buildRow({
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
          advance_paid_divergence_reason: 'Autorizado por dirección.',
        }),
      ])

      expect(wrapper.find('[data-testid="advance-paid-chip"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="advance-payment-divergence-chip"]').exists()).toBe(true)
    })
  })

  // ── Telmex bank-file exclusion chip (sdd/scholarship-telmex-iu-split,
  // design D9) ──────────────────────────────────────────────────────────
  //
  // Marks a $0.00 TELMEX row that Filter B will silently omit from the
  // exported bank file, so staff can predict that outcome before running the
  // export. Server-computed, same non-interactive tonal-chip pattern as
  // every other chip in this column.
  describe('telmex bank-file exclusion chip', () => {
    it('renders no chip when excluded_from_bank_file is false', () => {
      const wrapper = mountTable([buildRow({ excluded_from_bank_file: false })])

      expect(wrapper.find('[data-testid="telmex-exclusion-chip"]').exists()).toBe(false)
    })

    it('renders the chip with a visible label when excluded_from_bank_file is true', () => {
      const wrapper = mountTable([buildRow({ excluded_from_bank_file: true })])

      const chip = wrapper.find('[data-testid="telmex-exclusion-chip"]')
      expect(chip.exists()).toBe(true)
      expect(chip.text()).toContain('No entra al archivo')
    })

    it('the aria-label/tooltip explains the row will not appear in the bank file', () => {
      const wrapper = mountTable([buildRow({ excluded_from_bank_file: true })])

      const chip = wrapper.find('[data-testid="telmex-exclusion-chip"]')
      expect(chip.attributes('aria-label')).toContain('No se incluirá en el archivo bancario')
    })

    it('coexists with the other flags-column chips without displacing any', () => {
      const wrapper = mountTable([
        buildRow({
          has_incident: true,
          has_pending_from_previous: true,
          resolution_type: 'RETENIDA',
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
          excluded_from_bank_file: true,
        }),
      ])

      expect(wrapper.text()).toContain('Incidencia registrada')
      expect(wrapper.text()).toContain('Incluye mes retenido')
      expect(wrapper.find('[data-testid="resolution-chip"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="advance-paid-chip"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="telmex-exclusion-chip"]').exists()).toBe(true)
    })

    it('never affects is_payable or the Estado/Motivo columns for a payable, excluded row', () => {
      const wrapper = mountTable([
        buildRow({
          refrend_id: 12,
          is_payable: true,
          blocking_reasons: [],
          excluded_from_bank_file: true,
        }),
      ])

      const cells = dataRows(wrapper)[0].findAll('td')
      const estadoCell = cells[cells.length - 2]

      expect(estadoCell.text()).toContain('Listo')
      expect(wrapper.find('[data-testid="telmex-exclusion-chip"]').exists()).toBe(true)
    })
  })

  // ── Temporary-increase indicator chip (sdd/temporary-increase-visibility,
  // design D6/D8/P2b) ───────────────────────────────────────────────────────
  //
  // Data source is `snapshot_temporary_increase_amount`/`_reason` ONLY —
  // this suite includes an explicit regression test asserting the chip never
  // derives from `has_incident`/incident data, since the two indicators are
  // data-independent flags that happen to live in the same column.
  describe('temporary-increase indicator chip', () => {
    it('renders no chip when snapshot_temporary_increase_amount is null', () => {
      const wrapper = mountTable([buildRow({ snapshot_temporary_increase_amount: null })])

      expect(wrapper.find('[data-testid="temporary-increase-chip"]').exists()).toBe(false)
    })

    it('renders no chip when snapshot_temporary_increase_amount is "0.00"', () => {
      const wrapper = mountTable([buildRow({ snapshot_temporary_increase_amount: '0.00' })])

      expect(wrapper.find('[data-testid="temporary-increase-chip"]').exists()).toBe(false)
    })

    it('renders the chip with a visible label when the amount is positive', () => {
      const wrapper = mountTable([buildRow({ snapshot_temporary_increase_amount: '500.00' })])

      const chip = wrapper.find('[data-testid="temporary-increase-chip"]')
      expect(chip.exists()).toBe(true)
      expect(chip.text()).toContain('Aumento temporal')
    })

    it('the aria-label/tooltip includes the amount and the reason when present', () => {
      const wrapper = mountTable([
        buildRow({
          snapshot_temporary_increase_amount: '500.00',
          snapshot_temporary_increase_reason: 'Ajuste especial',
        }),
      ])

      const chip = wrapper.find('[data-testid="temporary-increase-chip"]')
      expect(chip.attributes('aria-label')).toBe('Aumento temporal · $500.00 · Motivo: Ajuste especial')
    })

    it('the aria-label/tooltip is the label plus amount alone when there is no reason', () => {
      const wrapper = mountTable([
        buildRow({ snapshot_temporary_increase_amount: '500.00', snapshot_temporary_increase_reason: null }),
      ])

      const chip = wrapper.find('[data-testid="temporary-increase-chip"]')
      expect(chip.attributes('aria-label')).toBe('Aumento temporal · $500.00')
    })

    it('coexists with the other flags-column chips without displacing any', () => {
      const wrapper = mountTable([
        buildRow({
          has_incident: true,
          has_pending_from_previous: true,
          resolution_type: 'RETENIDA',
          advance_paid: true,
          advance_paid_amount: '1500.00',
          advance_paid_origin_year: 2027,
          advance_paid_origin_month: 6,
          excluded_from_bank_file: true,
          snapshot_temporary_increase_amount: '500.00',
        }),
      ])

      expect(wrapper.text()).toContain('Incidencia registrada')
      expect(wrapper.text()).toContain('Incluye mes retenido')
      expect(wrapper.find('[data-testid="resolution-chip"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="advance-paid-chip"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="telmex-exclusion-chip"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="temporary-increase-chip"]').exists()).toBe(true)
    })

    // Regression lock: the chip's data source is the snapshot_temporary_
    // increase_* pair ONLY, never has_incident or any incident-related field
    // — a row with an active incident driven solely by
    // snapshot_discount_percentage (not modeled on PaymentBatchRow, but
    // has_incident stands in for "incident is true for unrelated reasons"
    // here) and no temporary increase must show the incidencia chip WITHOUT
    // the temporary-increase chip appearing.
    it('never derives from has_incident — chip absent when has_incident is true but there is no increase', () => {
      const wrapper = mountTable([
        buildRow({ has_incident: true, snapshot_temporary_increase_amount: '0.00' }),
      ])

      expect(wrapper.text()).toContain('Incidencia registrada')
      expect(wrapper.find('[data-testid="temporary-increase-chip"]').exists()).toBe(false)
    })

    it('never affects is_payable or the Estado/Motivo columns for a blocked row with a temporary increase', () => {
      const wrapper = mountTable([
        buildRow({
          refrend_id: 13,
          is_payable: false,
          blocking_reasons: [{ code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' }],
          snapshot_temporary_increase_amount: '500.00',
        }),
      ])

      const cells = dataRows(wrapper)[0].findAll('td')
      const estadoCell = cells[cells.length - 2]
      const motivoCell = cells[cells.length - 1]

      expect(estadoCell.text()).toContain('Bloqueado')
      expect(motivoCell.text()).toContain('Sin matrícula registrada')
      expect(wrapper.find('[data-testid="temporary-increase-chip"]').exists()).toBe(true)
    })
  })

  // ── Breakdown columns per scholarship type (sdd/lotes-pago-generacion-
  // desglose, spec "Breakdown columns rendered per scholarship type") ──────

  describe('breakdown columns per scholarship type', () => {
    it('IU row: Monto mensual = gross − apoyo − aumento temporal, Pago IU is a dash', () => {
      const wrapper = mountTable([
        buildRow({
          snapshot_scholarship_type: 'IU',
          snapshot_gross_amount: '1000.00',
          snapshot_monto_apoyo: '100.00',
          snapshot_temporary_increase_amount: '50.00',
        }),
      ])

      expect(wrapper.find('[data-testid="cell-monthly-amount"]').text()).toBe('$850.00')
      expect(wrapper.find('[data-testid="cell-iu-payment-amount"]').text()).toBe('—')
    })

    it('TELMEX_IU row: Pago IU = gross − aumento temporal, Monto mensual is a dash', () => {
      const wrapper = mountTable([
        buildRow({
          snapshot_scholarship_type: 'TELMEX_IU',
          snapshot_gross_amount: '1000.00',
          snapshot_temporary_increase_amount: '50.00',
        }),
      ])

      expect(wrapper.find('[data-testid="cell-iu-payment-amount"]').text()).toBe('$950.00')
      expect(wrapper.find('[data-testid="cell-monthly-amount"]').text()).toBe('—')
    })

    it('TELMEX row with a frozen temporary increase: both Monto mensual and Pago IU are dashes', () => {
      const wrapper = mountTable([
        buildRow({
          snapshot_scholarship_type: 'TELMEX',
          snapshot_temporary_increase_amount: '500.00',
        }),
      ])

      expect(wrapper.find('[data-testid="cell-monthly-amount"]').text()).toBe('—')
      expect(wrapper.find('[data-testid="cell-iu-payment-amount"]').text()).toBe('—')
    })

    it('Apoyo shows the formatted amount, or a dash when 0 or null', () => {
      const withApoyo = mountTable([buildRow({ snapshot_monto_apoyo: '100.00' })])
      expect(withApoyo.find('[data-testid="cell-support-amount"]').text()).toBe('$100.00')

      const withoutApoyo = mountTable([buildRow({ snapshot_monto_apoyo: null })])
      expect(withoutApoyo.find('[data-testid="cell-support-amount"]').text()).toBe('—')
    })

    it('Base shows snapshot_gross_amount with a "−X%" second line when discounted', () => {
      const wrapper = mountTable([
        buildRow({ snapshot_gross_amount: '1000.00', snapshot_discount_percentage: '10' }),
      ])

      const baseCell = wrapper.find('[data-testid="cell-base-amount"]')
      expect(baseCell.text()).toContain('$1,000.00')
      expect(baseCell.text()).toContain('−10%')
    })

    it('Base falls back to base_amount and shows no second line when there is no discount', () => {
      const wrapper = mountTable([
        buildRow({ snapshot_gross_amount: null, base_amount: '750.00', snapshot_discount_percentage: null }),
      ])

      expect(wrapper.find('[data-testid="cell-base-amount"]').text()).toBe('$750.00')
    })

    it('Desc.% renders in red only when the discount is positive, "—" at 0', () => {
      const withDiscount = mountTable([buildRow({ discount_percentage: '15' })])
      const discountCell = withDiscount.find('[data-testid="cell-discount-percent"]')
      expect(discountCell.text()).toBe('15%')
      expect(discountCell.classes()).toContain('text-error')

      const withoutDiscount = mountTable([buildRow({ discount_percentage: '0' })])
      const noDiscountCell = withoutDiscount.find('[data-testid="cell-discount-percent"]')
      expect(noDiscountCell.text()).toBe('—')
      expect(noDiscountCell.classes()).not.toContain('text-error')
    })

    it('Final shows only final_amount when there are no adjustments', () => {
      const wrapper = mountTable([
        buildRow({
          final_amount: '900.00',
          amount_pending_from_previous: '0.00',
          refund_amount_from_previous: '0.00',
          advance_payment_amount: '0.00',
        }),
      ])

      expect(wrapper.find('[data-testid="cell-final-amount"]').text()).toBe('$900.00')
    })

    it('Final shows final_amount plus one line per non-zero adjustment, all together, in a fixed order', () => {
      const wrapper = mountTable([
        buildRow({
          final_amount: '900.00',
          amount_pending_from_previous: '100.00',
          refund_amount_from_previous: '50.00',
          advance_payment_amount: '25.00',
        }),
      ])

      const text = wrapper.find('[data-testid="cell-final-amount"]').text()
      expect(text).toContain('$900.00')
      const retIndex = text.indexOf('ret.')
      const reembIndex = text.indexOf('reemb.')
      const adelantoIndex = text.indexOf('adelanto')
      expect(retIndex).toBeGreaterThan(-1)
      expect(reembIndex).toBeGreaterThan(retIndex)
      expect(adelantoIndex).toBeGreaterThan(reembIndex)
    })

    it('Total a pagar uses the same es-MX money format as the breakdown columns', () => {
      const wrapper = mountTable([buildRow({ total_to_pay: '12345.60' })])

      expect(wrapper.find('[data-testid="cell-total-to-pay"]').text()).toBe('$12,345.60')
    })
  })

  // ── Rows grouped by generación (sdd/lotes-pago-generacion-desglose, spec
  // "Rows grouped by generación with paid/unpaid header") ─────────────────

  describe('rows grouped by generación', () => {
    it('renders a group header with the generación label, count, and payable amount for an unpaid batch', () => {
      const rows = [
        buildRow({ refrend_id: 1, snapshot_generation: 'Generación 9', is_payable: true, total_to_pay: '1000.00' }),
        buildRow({ refrend_id: 2, snapshot_generation: 'Generación 9', is_payable: false, total_to_pay: '500.00' }),
      ]
      const wrapper = mountTable(rows, { groupSourceRows: rows, isPaid: false })

      const header = wrapper.find('[data-testid="payment-group-header"]')
      expect(header.exists()).toBe(true)
      expect(header.text()).toContain('Generación 9 — 2 becarios (1 listo) — $1,000.00 a pagar')
    })

    it('renders "Sin generación" for rows with a null snapshot_generation', () => {
      const rows = [buildRow({ snapshot_generation: null })]
      const wrapper = mountTable(rows, { groupSourceRows: rows })

      expect(wrapper.find('[data-testid="payment-group-header"]').text()).toContain('Sin generación')
    })

    it('renders the paid-batch header text, never "(M listos)" nor "$0.00 a pagar"', () => {
      const rows = [
        buildRow({ refrend_id: 1, payment_batch_id: 42, status: 'PAID', total_to_pay: '1000.00' }),
        buildRow({ refrend_id: 2, payment_batch_id: null, status: 'PAID', total_to_pay: '500.00' }),
      ]
      const wrapper = mountTable(rows, { groupSourceRows: rows, isPaid: true })

      const headerText = wrapper.find('[data-testid="payment-group-header"]').text()
      expect(headerText).toContain('Generación 9 — 2 becarios — $1,500.00 pagado')
      expect(headerText).not.toContain('listo')
      expect(headerText).not.toContain('$0.00 a pagar')
    })

    it('computes group header counts/sums from groupSourceRows, not from the (possibly filtered) rows prop', () => {
      const fullBatch = [
        buildRow({ refrend_id: 1, is_payable: true, total_to_pay: '1000.00' }),
        buildRow({ refrend_id: 2, is_payable: false, total_to_pay: '500.00' }),
      ]
      // Simulates "Solo pendientes de revisar" narrowing `rows` down to only
      // the blocked row, while `groupSourceRows` still carries the full batch.
      const wrapper = mountTable([fullBatch[1]], { groupSourceRows: fullBatch, isPaid: false })

      const headerText = wrapper.find('[data-testid="payment-group-header"]').text()
      expect(headerText).toContain('Generación 9 — 2 becarios (1 listo) — $1,000.00 a pagar')
    })

    it('falls back to the generación label alone when the group is absent from groupSourceRows', () => {
      const wrapper = mountTable([buildRow({ snapshot_generation: 'Generación 9' })], { groupSourceRows: [] })

      expect(wrapper.find('[data-testid="payment-group-header"]').text()).toBe('Generación 9')
    })
  })

  // ── Telmex coverage indicator chip (sdd/telmex-cobertura-iu PR5, design's
  // Lotes section, task 5.4) ──────────────────────────────────────────────
  //
  // Coverage is derived SOLELY from `snapshot_telmex_coverage_id !== null`
  // (NOT `excluded_from_bank_file`/`snapshot_scholarship_type`) — same
  // non-interactive tonal-chip pattern as every other flags-column chip,
  // must never displace or be displaced by any of them.
  describe('telmex coverage indicator chip', () => {
    it('renders no chip when snapshot_telmex_coverage_id is null', () => {
      const wrapper = mountTable([buildRow({ snapshot_telmex_coverage_id: null })])

      expect(wrapper.find('[data-testid="telmex-coverage-chip"]').exists()).toBe(false)
    })

    it('renders the chip with "Adelanto Telmex" when covered', () => {
      const wrapper = mountTable([
        buildRow({ snapshot_telmex_coverage_id: 7, snapshot_telmex_covered_amount: '1200.00' }),
      ])

      const chip = wrapper.find('[data-testid="telmex-coverage-chip"]')
      expect(chip.exists()).toBe(true)
      expect(chip.text()).toContain('Adelanto Telmex')
    })

    it('the aria-label/tooltip includes the covered amount', () => {
      const wrapper = mountTable([
        buildRow({ snapshot_telmex_coverage_id: 7, snapshot_telmex_covered_amount: '1200.00' }),
      ])

      const chip = wrapper.find('[data-testid="telmex-coverage-chip"]')
      expect(chip.attributes('aria-label')).toContain('$1,200.00')
    })

    it('coexists with the telmex bank-file exclusion chip without displacing it', () => {
      const wrapper = mountTable([
        buildRow({
          snapshot_telmex_coverage_id: 7,
          snapshot_telmex_covered_amount: '1200.00',
          excluded_from_bank_file: true,
        }),
      ])

      expect(wrapper.find('[data-testid="telmex-coverage-chip"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="telmex-exclusion-chip"]').exists()).toBe(true)
    })

    it('never affects is_payable or the Estado/Motivo columns for a payable, covered row', () => {
      const wrapper = mountTable([
        buildRow({
          refrend_id: 13,
          is_payable: true,
          blocking_reasons: [],
          snapshot_telmex_coverage_id: 7,
          snapshot_telmex_covered_amount: '1200.00',
        }),
      ])

      const cells = dataRows(wrapper)[0].findAll('td')
      const estadoCell = cells[cells.length - 2]

      expect(estadoCell.text()).toContain('Listo')
      expect(wrapper.find('[data-testid="telmex-coverage-chip"]').exists()).toBe(true)
    })
  })

  // ── "Cob. Telmex" column (sdd/telmex-cobertura-iu PR5, task 5.5) ────────
  describe('Cob. Telmex column', () => {
    it('renders the column header', () => {
      const wrapper = mountTable([buildRow()])

      const headers = wrapper.findAll('th').map((th) => th.text())
      expect(headers).toContain('Cob. Telmex')
    })

    it('shows a dash for an uncovered row', () => {
      const wrapper = mountTable([buildRow({ snapshot_telmex_coverage_id: null })])

      const cell = wrapper.find('[data-testid="cell-telmex-coverage-amount"]')
      expect(cell.text()).toBe('—')
    })

    it('shows the formatted covered amount for a covered row', () => {
      const wrapper = mountTable([
        buildRow({ snapshot_telmex_coverage_id: 7, snapshot_telmex_covered_amount: '1200.00' }),
      ])

      const cell = wrapper.find('[data-testid="cell-telmex-coverage-amount"]')
      expect(cell.text()).toBe('$1,200.00')
    })
  })
})
