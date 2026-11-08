// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VBtn } from 'vuetify/components'
import BankFileExportCard from '@/components/pagos/BankFileExportCard.vue'
import type { ExportSummary, InvalidBankRow } from '@/interfaces/payment'

// v-btn's loading state renders a v-progress-circular, which relies on
// ResizeObserver — same jsdom shim as PaymentsView.test.ts.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const vuetify = createVuetify()

const BECA_LABEL = 'Descargar archivo Beca'
const APOYO_LABEL = 'Descargar archivo Apoyo'

const buildExportSummary = (overrides: Partial<ExportSummary> = {}): ExportSummary => ({
  count: 4,
  total_amount: '2600.02',
  batch_type: 'NORMAL',
  files: {
    beca: { count: 4, total_amount: '2400.02', filename: 'PAGO_MERIDA_202609_42_BECA.TXT' },
    apoyo: { count: 3, total_amount: '200.00', filename: 'PAGO_MERIDA_202609_42_APOYO.TXT' },
  },
  ...overrides,
})

const mountCard = (props: Record<string, unknown> = {}) =>
  mount(BankFileExportCard, {
    global: { plugins: [vuetify] },
    props: { exportSummary: buildExportSummary(), ...props },
  })

const findButton = (wrapper: ReturnType<typeof mountCard>, label: string) =>
  wrapper.findAllComponents(VBtn).find((b) => b.text() === label)

describe('BankFileExportCard', () => {
  it('renders the combined count and total amount from exportSummary', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('Becarios a Dispersar')
    expect(wrapper.text()).toContain('Cantidad Total a Dispersar')
    expect(wrapper.text()).toContain('2600.02')
  })

  it('renders one sub-card per concept with its own count, total and filename', () => {
    const wrapper = mountCard()
    const beca = wrapper.get('[data-testid="export-file-beca"]')
    const apoyo = wrapper.get('[data-testid="export-file-apoyo"]')

    expect(beca.text()).toContain('2400.02')
    expect(beca.text()).toContain('4')
    expect(beca.text()).toContain('PAGO_MERIDA_202609_42_BECA.TXT')
    expect(apoyo.text()).toContain('200.00')
    expect(apoyo.text()).toContain('3')
    expect(apoyo.text()).toContain('PAGO_MERIDA_202609_42_APOYO.TXT')
  })

  it('shows per-concept totals that add up to the combined total', () => {
    const summary = buildExportSummary()
    const wrapper = mountCard({ exportSummary: summary })
    const cents = (value: string): number => Math.round(Number(value) * 100)

    expect(cents(summary.files.beca.total_amount) + cents(summary.files.apoyo.total_amount)).toBe(
      cents(summary.total_amount),
    )
    expect(wrapper.get('[data-testid="export-file-beca"]').text()).toContain(summary.files.beca.total_amount)
    expect(wrapper.get('[data-testid="export-file-apoyo"]').text()).toContain(summary.files.apoyo.total_amount)
    expect(wrapper.text()).toContain(summary.total_amount)
  })

  it('renders nothing when exportSummary is null', () => {
    const wrapper = mountCard({ exportSummary: null })

    expect(wrapper.text()).not.toContain(BECA_LABEL)
    expect(wrapper.text()).not.toContain(APOYO_LABEL)
  })

  it('emits "download" with the concept of the clicked button', async () => {
    const wrapper = mountCard()

    await findButton(wrapper, BECA_LABEL)?.trigger('click')
    await findButton(wrapper, APOYO_LABEL)?.trigger('click')

    expect(wrapper.emitted('download')).toEqual([['beca'], ['apoyo']])
  })

  it('disables the button of a concept with no becarios and explains why', () => {
    const wrapper = mountCard({
      exportSummary: buildExportSummary({
        files: {
          beca: { count: 4, total_amount: '2600.02', filename: 'PAGO_MERIDA_202609_42_BECA.TXT' },
          apoyo: { count: 0, total_amount: '0.00', filename: 'PAGO_MERIDA_202609_42_APOYO.TXT' },
        },
      }),
    })

    expect(findButton(wrapper, APOYO_LABEL)?.props('disabled')).toBe(true)
    expect(findButton(wrapper, BECA_LABEL)?.props('disabled')).toBe(false)
    expect(wrapper.get('[data-testid="export-file-apoyo"]').text()).toContain('No hay montos de apoyo por dispersar')
  })

  it('shows loading only on the concept being downloaded', () => {
    const wrapper = mountCard({ loadingExport: { beca: false, apoyo: true } })

    expect(findButton(wrapper, BECA_LABEL)?.props('loading')).toBe(false)
    expect(findButton(wrapper, APOYO_LABEL)?.props('loading')).toBe(true)
  })

  // spec's requirement: the admin needs to know WHO to fix, not a generic
  // error toast — one line per becario naming it and its reason(s).
  it('renders one line per invalid row with its name and reasons when exportError is "blocked"', () => {
    const invalidRows: InvalidBankRow[] = [
      {
        refrend_id: 3,
        snapshot_name: 'Grace Hopper',
        account_number: 'ABC123',
        rfc: null,
        reasons: [{ code: 'INVALID_ACCOUNT_NUMBER', message: 'Número de cuenta inválido: debe ser numérico de 9 o 10 dígitos' }],
      },
      {
        refrend_id: 5,
        snapshot_name: 'Ada Lovelace',
        account_number: '012180001234567895',
        rfc: 'BADRFC',
        reasons: [{ code: 'INVALID_RFC', message: 'RFC con estructura inválida' }],
      },
    ]
    const wrapper = mountCard({ exportError: 'blocked', invalidRows })

    expect(wrapper.text()).toContain('Grace Hopper')
    expect(wrapper.text()).toContain('Número de cuenta inválido: debe ser numérico de 9 o 10 dígitos')
    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('RFC con estructura inválida')
  })

  it('shows a generic error message (not the invalid-rows list) when exportError is "error"', () => {
    const wrapper = mountCard({ exportError: 'error' })

    expect(wrapper.text()).toContain('No se pudo descargar')
  })

  it('does not raise console errors when a download button is clicked twice quickly', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountCard()

    const downloadButton = findButton(wrapper, BECA_LABEL)
    await downloadButton?.trigger('click')
    await downloadButton?.trigger('click')

    expect(errorSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('download')).toHaveLength(2)
    errorSpy.mockRestore()
  })
})
