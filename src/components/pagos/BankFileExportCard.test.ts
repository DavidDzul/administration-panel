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

const buildExportSummary = (overrides: Partial<ExportSummary> = {}): ExportSummary => ({
  count: 4,
  total_amount: '2600.02',
  filename: 'PAGO_1_MERIDA_202609_42.TXT',
  ...overrides,
})

describe('BankFileExportCard', () => {
  it('renders the count and total amount from exportSummary', () => {
    const wrapper = mount(BankFileExportCard, {
      global: { plugins: [vuetify] },
      props: { exportSummary: buildExportSummary({ count: 4, total_amount: '2600.02' }) },
    })

    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('Empleados a Dispersar')
    expect(wrapper.text()).toContain('2600.02')
    expect(wrapper.text()).toContain('Cantidad Total a Dispersar')
  })

  it('renders nothing when exportSummary is null', () => {
    const wrapper = mount(BankFileExportCard, {
      global: { plugins: [vuetify] },
      props: { exportSummary: null },
    })

    expect(wrapper.text()).not.toContain('Descargar archivo de pago')
  })

  it('emits "download" when the download button is clicked', async () => {
    const wrapper = mount(BankFileExportCard, {
      global: { plugins: [vuetify] },
      props: { exportSummary: buildExportSummary() },
    })

    const downloadButton = wrapper.findAllComponents(VBtn).find((b) => b.text() === 'Descargar archivo de pago')
    await downloadButton?.trigger('click')

    expect(wrapper.emitted('download')).toHaveLength(1)
  })

  it('shows the button as loading while loadingExport is true', () => {
    const wrapper = mount(BankFileExportCard, {
      global: { plugins: [vuetify] },
      props: { exportSummary: buildExportSummary(), loadingExport: true },
    })

    const downloadButton = wrapper.findAllComponents(VBtn).find((b) => b.text() === 'Descargar archivo de pago')
    expect(downloadButton?.props('loading')).toBe(true)
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
    const wrapper = mount(BankFileExportCard, {
      global: { plugins: [vuetify] },
      props: { exportSummary: buildExportSummary(), exportError: 'blocked', invalidRows },
    })

    expect(wrapper.text()).toContain('Grace Hopper')
    expect(wrapper.text()).toContain('Número de cuenta inválido: debe ser numérico de 9 o 10 dígitos')
    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('RFC con estructura inválida')
  })

  it('shows a generic error message (not the invalid-rows list) when exportError is "error"', () => {
    const wrapper = mount(BankFileExportCard, {
      global: { plugins: [vuetify] },
      props: { exportSummary: buildExportSummary(), exportError: 'error' },
    })

    expect(wrapper.text()).toContain('No se pudo descargar')
  })

  it('does not raise console errors when the download button is clicked twice quickly', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mount(BankFileExportCard, {
      global: { plugins: [vuetify] },
      props: { exportSummary: buildExportSummary() },
    })

    const downloadButton = wrapper.findAllComponents(VBtn).find((b) => b.text() === 'Descargar archivo de pago')
    await downloadButton?.trigger('click')
    await downloadButton?.trigger('click')

    expect(errorSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('download')).toHaveLength(2)
    errorSpy.mockRestore()
  })
})
