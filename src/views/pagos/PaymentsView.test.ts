// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VSelect, VBtn, VSwitch } from 'vuetify/components'
import type { PaymentBatchRow } from '@/interfaces/payment'

// v-data-table's pagination footer relies on ResizeObserver — same jsdom
// shim as AccesosView.test.ts / RolesView.test.ts.
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

// usePaymentsPage is deliberately NOT mocked in this file — per instruction,
// same rationale as AccesosView.test.ts: mocking it would only assert the
// store's internal state changed, never that the real reactive chain
// (store -> composable -> component) actually re-renders. Only the network
// boundary (axiosConfig) is mocked.
const { mockAxiosGet, mockAxiosPost } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockAxiosPost: vi.fn(),
}))
vi.mock('@/axiosConfig', () => ({
  default: { get: mockAxiosGet, post: mockAxiosPost },
}))

import PaymentsView from '@/views/pagos/PaymentsView.vue'
import { useAuthStore } from '@/stores/api/authStore'

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
  ...overrides,
})

const mountView = () =>
  mount(PaymentsView, {
    global: { plugins: [vuetify] },
  })

const body = () => new DOMWrapper(document.body)

const selectByLabel = (wrapper: ReturnType<typeof mountView>, label: string) =>
  wrapper.findAllComponents(VSelect).find((s) => s.props('label') === label)

const setAllFilters = async (wrapper: ReturnType<typeof mountView>): Promise<void> => {
  await selectByLabel(wrapper, 'Sede')?.vm.$emit('update:modelValue', 'MERIDA')
  await selectByLabel(wrapper, 'Año')?.vm.$emit('update:modelValue', 2026)
  await selectByLabel(wrapper, 'Mes')?.vm.$emit('update:modelValue', 9)
  await selectByLabel(wrapper, 'Tipo de lote')?.vm.$emit('update:modelValue', 'NORMAL')
  await flushPromises()
}

const grantPermissions = (canProcess: boolean, canExport = false): void => {
  const permissions = ['ADM_READ_PAYMENTS']
  if (canProcess) permissions.push('ADM_PROCESS_PAYMENTS')
  if (canExport) permissions.push('ADM_EXPORT_PAYMENTS')
  useAuthStore().permissions = permissions
}

const mockBatch = (
  rows: PaymentBatchRow[],
  summary: Record<string, unknown>,
  batch: Record<string, unknown> = { batch_id: null, is_paid: false },
): void => {
  mockAxiosGet.mockImplementation((url: string) => {
    if (url === 'api/admin/scholarship-payments') {
      return Promise.resolve({ data: { res: true, data: { rows, summary, batch } } })
    }
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

describe('PaymentsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
    mockAxiosPost.mockReset()
    grantPermissions(true)
    mockBatch([buildRow()], {
  total: 1,
  ready: 1,
  blocking: 0,
  beca_amount: '1000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  total_amount: '1000.00',
  difference_amount: '0.00',
})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not fetch the batch or show a table until all 3 filters are chosen', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(mockAxiosGet).not.toHaveBeenCalledWith('api/admin/scholarship-payments', expect.anything())
    expect(wrapper.findComponent({ name: 'VDataTable' }).exists()).toBe(false)
  })

  it('fetches the batch with the exact key once all 4 filters are chosen, and renders summary + table', async () => {
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    expect(mockAxiosGet).toHaveBeenCalledWith(
      'api/admin/scholarship-payments',
      expect.objectContaining({
        params: { campus: 'MERIDA', period_year: 2026, period_month: 9, batch_type: 'NORMAL' },
      }),
    )
    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('1') // total becarios
  })

  // Amendment #1942: "Tipo de lote" has NO default — it must gate the fetch
  // exactly like Sede/Año/Mes, not just be along for the ride.
  it('does not fetch the batch when Sede/Año/Mes are set but Tipo de lote is not chosen', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectByLabel(wrapper, 'Sede')?.vm.$emit('update:modelValue', 'MERIDA')
    await selectByLabel(wrapper, 'Año')?.vm.$emit('update:modelValue', 2026)
    await selectByLabel(wrapper, 'Mes')?.vm.$emit('update:modelValue', 9)
    await flushPromises()

    expect(mockAxiosGet).not.toHaveBeenCalledWith('api/admin/scholarship-payments', expect.anything())
  })

  it('renders the "Tipo de lote" select with no default value', async () => {
    const wrapper = mountView()
    await flushPromises()

    const select = selectByLabel(wrapper, 'Tipo de lote')
    expect(select).toBeDefined()
    expect(select?.props('modelValue')).toBeFalsy()
  })

  it('shows a chip with the selected batch type label once the batch loads', async () => {
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    const chip = wrapper.find('[data-testid="batch-type-chip"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toContain('Normal')
  })

  it('shows the "CERT-UNID" chip label when that batch type is selected', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectByLabel(wrapper, 'Sede')?.vm.$emit('update:modelValue', 'MERIDA')
    await selectByLabel(wrapper, 'Año')?.vm.$emit('update:modelValue', 2026)
    await selectByLabel(wrapper, 'Mes')?.vm.$emit('update:modelValue', 9)
    await selectByLabel(wrapper, 'Tipo de lote')?.vm.$emit('update:modelValue', 'CERT_UNID')
    await flushPromises()

    const chip = wrapper.find('[data-testid="batch-type-chip"]')
    expect(chip.text()).toContain('CERT-UNID')
    expect(mockAxiosGet).toHaveBeenCalledWith(
      'api/admin/scholarship-payments',
      expect.objectContaining({
        params: { campus: 'MERIDA', period_year: 2026, period_month: 9, batch_type: 'CERT_UNID' },
      }),
    )
  })

  it('shows the readiness chip and the specific blocking reason per row', async () => {
    mockBatch(
      [
        buildRow({ refrend_id: 1, snapshot_name: 'Ada Lovelace', is_payable: true }),
        buildRow({
          refrend_id: 2,
          snapshot_name: 'Grace Hopper',
          is_payable: false,
          blocking_reasons: [{ code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' }],
        }),
      ],
      {
  total: 2,
  ready: 1,
  blocking: 1,
  beca_amount: '2000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  total_amount: '2000.00',
  difference_amount: '0.00',
},
    )
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    expect(wrapper.text()).toContain('Sin matrícula registrada')
  })

  it('does not render "Pagar todos" when the user lacks ADM_PROCESS_PAYMENTS', async () => {
    grantPermissions(false)
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    expect(wrapper.text()).not.toContain('Pagar todos')
  })

  it('disables "Pagar todos" when the batch has a blocking row', async () => {
    mockBatch(
      [buildRow({ refrend_id: 1, is_payable: true }), buildRow({ refrend_id: 2, is_payable: false })],
      {
  total: 2,
  ready: 1,
  blocking: 1,
  beca_amount: '2000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  total_amount: '2000.00',
  difference_amount: '0.00',
},
    )
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    const payButton = wrapper.findAllComponents(VBtn).find((b) => b.text() === 'Pagar todos')
    expect(payButton?.props('disabled')).toBe(true)
  })

  it('enables "Pagar todos" once the batch is fully ready, and processing posts the batch key + totals', async () => {
    mockAxiosPost.mockResolvedValueOnce({
      data: { res: true, data: { batch_id: 42, rows: [buildRow({ outcome: 'PAID' })] } },
    })
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    const payButton = wrapper.findAllComponents(VBtn).find((b) => b.text() === 'Pagar todos')
    expect(payButton?.props('disabled')).toBe(false)

    await payButton?.trigger('click')
    await flushPromises()

    // Confirmation dialog shows an explicit irreversibility warning.
    expect(body().text()).toContain('irreversible')

    for (const btn of body().findAll('button')) {
      if (btn.text() === 'Confirmar pago') await btn.trigger('click')
    }
    await flushPromises()

    expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/scholarship-payments/process', {
      campus: 'MERIDA',
      period_year: 2026,
      period_month: 9,
      batch_type: 'NORMAL',
      expected_count: 1,
      expected_total: '1000.00',
    })
  })

  // Regression guard (bug fix): the backend returns 409 for TWO distinct
  // cases. "already_processed" (batch_id present) MUST render its own
  // message, never the generic/stale text, and must not be silently
  // swallowed (console-only).
  it('shows a distinct message when "Pagar todos" fails because the batch was already processed (409 + batch_id)', async () => {
    mockAxiosPost.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { res: false, msg: 'Este lote ya fue procesado anteriormente.', data: { batch_id: 42 } },
      },
    })
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    const payButton = wrapper.findAllComponents(VBtn).find((b) => b.text() === 'Pagar todos')
    await payButton?.trigger('click')
    await flushPromises()

    for (const btn of body().findAll('button')) {
      if (btn.text() === 'Confirmar pago') await btn.trigger('click')
    }
    await flushPromises()

    expect(wrapper.text()).toContain('Este lote ya fue procesado anteriormente.')
    expect(wrapper.text()).not.toContain('El lote cambió')
  })

  // Regression guard: the stale case (409 without batch_id) must keep
  // surfacing its own message, distinct from "already_processed".
  it('shows a distinct message when "Pagar todos" fails because the batch is stale (409 without batch_id)', async () => {
    mockAxiosPost.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { res: false, msg: 'stale', data: { count: 2, total_amount: '2000.00' } },
      },
    })
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    const payButton = wrapper.findAllComponents(VBtn).find((b) => b.text() === 'Pagar todos')
    await payButton?.trigger('click')
    await flushPromises()

    for (const btn of body().findAll('button')) {
      if (btn.text() === 'Confirmar pago') await btn.trigger('click')
    }
    await flushPromises()

    expect(wrapper.text()).toContain('El lote cambió desde que se cargó la pantalla')
    expect(wrapper.text()).not.toContain('ya fue procesado anteriormente')
  })

  // Note: this guard originally asserted NO "Generación" text anywhere —
  // that predates sdd/lotes-pago-generacion-desglose, which deliberately
  // introduces visible generación GROUP HEADERS (spec: "Rows grouped by
  // generación with paid/unpaid header"). The guard is narrowed to its real
  // intent: no generación FILTER selector, and no dedicated generación
  // COLUMN — grouping is shown via the table's group-header rows, not a
  // filter or a per-row column.
  it('renders no Generación filter selector or dedicated column in Pagos', async () => {
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    expect(selectByLabel(wrapper, 'Generación')).toBeUndefined()
    const headers = wrapper.findAll('th').map((th) => th.text())
    expect(headers).not.toContain('Generación')
  })

  it('opens the payment document dialog for the clicked row instead of navigating away (sdd/becario-payment-batch-indicators)', async () => {
    mockAxiosGet.mockImplementation((url: string) => {
      if (url === 'api/admin/scholarship-payments') {
        return Promise.resolve({
          data: {
            res: true,
            data: { rows: [buildRow({ refrend_id: 3, snapshot_name: 'Ada Lovelace' })], summary: {
  total: 1,
  ready: 1,
  blocking: 0,
  beca_amount: '1000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  total_amount: '1000.00',
  difference_amount: '0.00',
} },
          },
        })
      }
      if (url === 'api/admin/scholarship-payments/3/document') {
        return Promise.resolve({
          data: {
            res: true,
            data: {
              refrend_id: 3,
              user_id: 1,
              enrollment: 'A0001',
              snapshot_name: 'Ada Lovelace',
              incidents: [],
              carryover_months_count: null,
              carryover_months_detail: null,
              atencion_observations: null,
              pedagogia_observations: null,
              resolution_notes: null,
              amount_breakdown: {
                base_amount: '1000.00',
                discount_percentage: '0.00',
                discount_amount: '0.00',
                amount_pending_from_previous: '0.00',
                final_amount: '1000.00',
                total_to_pay: '1000.00',
              },
              retentions: {
                ledger_applied: [],
                ledger_applied_total: '0.00',
                origin_withholding: null,
                attendance_discounts: [],
                definitive_discount: null,
              },
            },
          },
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    // The standalone "Ver" button/column is gone (sdd/lotes-pago-generacion-
    // desglose) — the becario name itself is now the trigger.
    const nameButton = wrapper.find('button.payment-name-link')
    await nameButton.trigger('click')
    await flushPromises()

    expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/scholarship-payments/3/document')
    expect(body().text()).toContain('Documento de pago')
    // The list view (filters/table) stays mounted underneath — no navigation happened.
    expect(wrapper.text()).toContain('Ada Lovelace')
  })

  // ── Breakdown + grouped-by-generación table (sdd/lotes-pago-generacion-
  // desglose) ───────────────────────────────────────────────────────────

  it('passes the full batch rows and isPaid through to the table for group headers, not the filtered visibleRows', async () => {
    mockBatch(
      [
        buildRow({ refrend_id: 1, snapshot_name: 'Ada Lovelace', is_payable: true, total_to_pay: '1000.00' }),
        buildRow({ refrend_id: 2, snapshot_name: 'Grace Hopper', is_payable: false, total_to_pay: '500.00' }),
      ],
      {
        total: 2,
        ready: 1,
        blocking: 1,
        beca_amount: '1500.00',
        apoyo_amount: '0.00',
        pago_iu_amount: '0.00',
        total_amount: '1500.00',
        difference_amount: '0.00',
      },
    )
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    const groupHeader = wrapper.find('[data-testid="payment-group-header"]')
    expect(groupHeader.exists()).toBe(true)
    expect(groupHeader.text()).toContain('Generación 9 — 2 becarios (1 listo) — $1,000.00 a pagar')
  })

  it('"Solo pendientes de revisar" narrows the rendered rows without changing the group header counts', async () => {
    mockBatch(
      [
        buildRow({ refrend_id: 1, snapshot_name: 'Ada Lovelace', is_payable: true, total_to_pay: '1000.00' }),
        buildRow({ refrend_id: 2, snapshot_name: 'Grace Hopper', is_payable: false, total_to_pay: '500.00' }),
      ],
      {
        total: 2,
        ready: 1,
        blocking: 1,
        beca_amount: '1500.00',
        apoyo_amount: '0.00',
        pago_iu_amount: '0.00',
        total_amount: '1500.00',
        difference_amount: '0.00',
      },
    )
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    const headerTextBefore = wrapper.find('[data-testid="payment-group-header"]').text()

    const toggle = wrapper.findComponent(VSwitch)
    await toggle.vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('Grace Hopper')
    expect(wrapper.find('[data-testid="payment-group-header"]').text()).toBe(headerTextBefore)
  })

  it('hides the summary cards once the batch is already paid, but keeps the table and "Pagar todos"', async () => {
    mockBatch(
      [buildRow()],
      {
  total: 1,
  ready: 1,
  blocking: 0,
  beca_amount: '1000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  total_amount: '1000.00',
  difference_amount: '0.00',
},
      { batch_id: 42, is_paid: true },
    )
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    expect(wrapper.text()).not.toContain('Total becarios')
    expect(wrapper.text()).not.toContain('Bloqueados')
    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('Pagar todos')
  })

  it('shows the summary cards while the batch is not yet paid', async () => {
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    expect(wrapper.text()).toContain('Total becarios')
  })

  it('toggling "solo pendientes de revisar" narrows which rows the table receives, without an extra fetch', async () => {
    mockBatch(
      [
        buildRow({ refrend_id: 1, snapshot_name: 'Ada Lovelace', is_payable: true }),
        buildRow({ refrend_id: 2, snapshot_name: 'Grace Hopper', is_payable: false }),
      ],
      {
  total: 2,
  ready: 1,
  blocking: 1,
  beca_amount: '2000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  total_amount: '2000.00',
  difference_amount: '0.00',
},
    )
    const wrapper = mountView()
    await flushPromises()
    await setAllFilters(wrapper)

    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('Grace Hopper')

    const fetchCallsBeforeToggle = mockAxiosGet.mock.calls.length
    const toggle = wrapper.findComponent(VSwitch)
    await toggle.vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('Grace Hopper')
    expect(mockAxiosGet.mock.calls.length).toBe(fetchCallsBeforeToggle)
  })

  describe('bank-file export (sdd/becario-payment-bank-file-export)', () => {
    const mockExportEndpoints = ({
      batch = { batch_id: 42, is_paid: true },
      exportSummary = { count: 1, total_amount: '1000.00', filename: 'PAGO_MERIDA_202609_42.TXT' },
    }: {
      batch?: Record<string, unknown>
      exportSummary?: Record<string, unknown>
    } = {}): void => {
      mockAxiosGet.mockImplementation((url: string) => {
        if (url === 'api/admin/scholarship-payments') {
          return Promise.resolve({
            data: {
              res: true,
              data: { rows: [buildRow()], summary: {
  total: 1,
  ready: 1,
  blocking: 0,
  beca_amount: '1000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  total_amount: '1000.00',
  difference_amount: '0.00',
}, batch },
            },
          })
        }
        if (url === 'api/admin/scholarship-payments/batches/42/export/summary') {
          return Promise.resolve({ data: { res: true, data: exportSummary } })
        }
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
    }

    it('does not render the export card without ADM_EXPORT_PAYMENTS, even when the batch is already paid', async () => {
      grantPermissions(true, false)
      mockExportEndpoints()
      const wrapper = mountView()
      await flushPromises()
      await setAllFilters(wrapper)

      expect(wrapper.text()).not.toContain('Descargar archivo de pago')
    })

    it('does not render the export card when the batch is not yet paid, even with permission', async () => {
      grantPermissions(true, true)
      mockExportEndpoints({ batch: { batch_id: null, is_paid: false } })
      const wrapper = mountView()
      await flushPromises()
      await setAllFilters(wrapper)

      expect(wrapper.text()).not.toContain('Descargar archivo de pago')
    })

    it('renders the summary and download button once the batch is paid and the permission is held', async () => {
      grantPermissions(true, true)
      mockExportEndpoints()
      const wrapper = mountView()
      await flushPromises()
      await setAllFilters(wrapper)
      await flushPromises()

      expect(wrapper.text()).toContain('Becarios a Dispersar')
      expect(wrapper.text()).toContain('1000.00')
      expect(wrapper.text()).toContain('Descargar archivo de pago')
    })

    it('lists each blocked becario by name with its reason when the download is rejected with 422', async () => {
      grantPermissions(true, true)
      mockExportEndpoints()
      const errorBody = JSON.stringify({
        res: false,
        msg: 'El lote tiene becarios con datos bancarios inválidos.',
        data: {
          invalid_rows: [
            {
              refrend_id: 1,
              snapshot_name: 'Ada Lovelace',
              account_number: 'ABC123',
              rfc: null,
              reasons: [{ code: 'INVALID_ACCOUNT_NUMBER', message: 'Número de cuenta inválido: debe ser numérico de 9 o 10 dígitos' }],
            },
          ],
        },
      })
      mockAxiosGet.mockImplementation((url: string) => {
        if (url === 'api/admin/scholarship-payments') {
          return Promise.resolve({
            data: {
              res: true,
              data: {
                rows: [buildRow()],
                summary: {
  total: 1,
  ready: 1,
  blocking: 0,
  beca_amount: '1000.00',
  apoyo_amount: '0.00',
  pago_iu_amount: '0.00',
  total_amount: '1000.00',
  difference_amount: '0.00',
},
                batch: { batch_id: 42, is_paid: true },
              },
            },
          })
        }
        if (url === 'api/admin/scholarship-payments/batches/42/export/summary') {
          return Promise.resolve({
            data: { res: true, data: { count: 1, total_amount: '1000.00', filename: 'PAGO_MERIDA_202609_42.TXT' } },
          })
        }
        if (url === 'api/admin/scholarship-payments/batches/42/export') {
          return Promise.reject({ response: { status: 422, data: new Blob([errorBody], { type: 'application/json' }) } })
        }
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })

      const wrapper = mountView()
      await flushPromises()
      await setAllFilters(wrapper)
      await flushPromises()

      const downloadButton = wrapper.findAllComponents(VBtn).find((b) => b.text() === 'Descargar archivo de pago')
      await downloadButton?.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('Ada Lovelace')
      expect(wrapper.text()).toContain('Número de cuenta inválido: debe ser numérico de 9 o 10 dígitos')
    })
  })

  // pago-cheque PR7: cheque section + dialogs wired to the composable.
  describe('cheque payments', () => {
    const transferSummary = {
      total: 1,
      ready: 1,
      blocking: 0,
      beca_amount: '1000.00',
      apoyo_amount: '0.00',
      pago_iu_amount: '0.00',
      total_amount: '1000.00',
      difference_amount: '0.00',
    }
    const emptySummary = { ...transferSummary, total: 0, ready: 0, total_amount: '0.00', beca_amount: '0.00' }
    const chequeSummary = { total: 2, ready: 1, paid: 1, blocking: 0, ready_amount: '1500.00', paid_amount: '800.00' }

    const chequeRow = (overrides: Record<string, unknown> = {}) =>
      buildRow({
        refrend_id: 10,
        snapshot_name: 'Grace Hopper',
        total_to_pay: '1500.00',
        payment_method: 'CHEQUE',
        paid_payment_method: null,
        cheque_number: null,
        cheque_delivered_at: null,
        cheque_notes: null,
        cheque_beneficiary: null,
        ...overrides,
      } as Partial<PaymentBatchRow>)

    const paidChequeRow = () =>
      chequeRow({
        refrend_id: 11,
        snapshot_name: 'Alan Turing',
        status: 'PAID',
        is_payable: false,
        paid_payment_method: 'CHEQUE',
        cheque_number: 'CH-77',
        cheque_delivered_at: '2026-10-05',
      })

    const mockWithCheques = (
      chequeRows: PaymentBatchRow[],
      options: { rows?: PaymentBatchRow[]; summary?: Record<string, unknown>; batch?: Record<string, unknown> } = {},
    ): void => {
      mockAxiosGet.mockImplementation((url: string) => {
        if (url === 'api/admin/scholarship-payments') {
          return Promise.resolve({
            data: {
              res: true,
              data: {
                rows: options.rows ?? [buildRow()],
                summary: options.summary ?? transferSummary,
                batch: options.batch ?? { batch_id: null, is_paid: false },
                cheque_rows: chequeRows,
                cheque_summary: chequeSummary,
              },
            },
          })
        }
        if (url.includes('/export/summary')) {
          return Promise.resolve({
            data: { res: true, data: { count: 1, total_amount: '1000.00', filename: 'X.TXT' } },
          })
        }
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
    }

    const apiError = (status: number, data: Record<string, unknown>) => ({ response: { status, data } })

    const buttonByText = (wrapper: ReturnType<typeof mountView>, text: string) =>
      wrapper.findAllComponents(VBtn).find((b) => b.text() === text)

    const dialogButton = (text: string) =>
      body()
        .findAll('button')
        .find((b) => b.text() === text)

    const openMarkDialog = async (wrapper: ReturnType<typeof mountView>): Promise<void> => {
      await buttonByText(wrapper, 'Marcar como pagado')?.trigger('click')
      await flushPromises()
    }

    const fillChequeNumber = async (wrapper: ReturnType<typeof mountView>, value: string): Promise<void> => {
      const input = wrapper
        .findAllComponents({ name: 'VTextField' })
        .find((f) => String(f.props('label')).startsWith('Número de cheque'))
      await input?.setValue(value)
    }

    const markDialogOpen = (wrapper: ReturnType<typeof mountView>): boolean =>
      wrapper.findComponent({ name: 'ChequePaymentDialog' }).props('modelValue') as boolean

    const revertDialogOpen = (wrapper: ReturnType<typeof mountView>): boolean =>
      wrapper.findComponent({ name: 'RevertChequePaymentDialog' }).props('modelValue') as boolean

    const submitMark = async (wrapper: ReturnType<typeof mountView>): Promise<void> => {
      await openMarkDialog(wrapper)
      await fillChequeNumber(wrapper, 'CH-100')
      await dialogButton('Registrar pago')?.trigger('click')
      await flushPromises()
    }

    const submitRevert = async (wrapper: ReturnType<typeof mountView>): Promise<void> => {
      await buttonByText(wrapper, 'Revertir')?.trigger('click')
      await flushPromises()
      const reason = wrapper.findAllComponents({ name: 'VTextarea' }).find((f) => f.props('label') === 'Motivo *')
      await reason?.setValue('Cheque emitido por error')
      await dialogButton('Revertir pago')?.trigger('click')
      await flushPromises()
    }

    const mounted = async () => {
      const wrapper = mountView()
      await flushPromises()
      await setAllFilters(wrapper)
      return wrapper
    }

    it('does not render the cheque section when there are no cheque rows', async () => {
      mockWithCheques([])
      const wrapper = await mounted()
      expect(wrapper.find('[data-testid="cheque-section"]').exists()).toBe(false)
    })

    it('renders the cheque section below the transfer table for an unpaid batch', async () => {
      mockWithCheques([chequeRow()])
      const wrapper = await mounted()
      expect(wrapper.find('[data-testid="cheque-section"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Grace Hopper')
    })

    it('renders the cheque section when the transfer batch is already paid', async () => {
      mockWithCheques([chequeRow()], { batch: { batch_id: 42, is_paid: true } })
      const wrapper = await mounted()
      expect(wrapper.find('[data-testid="cheque-section"]').exists()).toBe(true)
    })

    it('shows a transfer-less message and hides "Pagar todos" when the batch only has cheques', async () => {
      mockWithCheques([chequeRow()], { rows: [], summary: emptySummary })
      const wrapper = await mounted()
      expect(wrapper.text()).toContain('No hay becarios con pago por transferencia en este lote.')
      expect(buttonByText(wrapper, 'Pagar todos')).toBeUndefined()
      expect(wrapper.text()).not.toContain('No hay becarios en este lote')
      expect(wrapper.find('[data-testid="cheque-section"]').exists()).toBe(true)
    })

    it('does not show the transfer-less message when there are transfer rows', async () => {
      mockWithCheques([chequeRow()])
      const wrapper = await mounted()
      expect(wrapper.text()).not.toContain('No hay becarios con pago por transferencia en este lote.')
    })

    it('hides cheque actions without ADM_PROCESS_PAYMENTS', async () => {
      grantPermissions(false)
      mockWithCheques([chequeRow(), paidChequeRow()])
      const wrapper = await mounted()
      expect(buttonByText(wrapper, 'Marcar como pagado')).toBeUndefined()
      expect(buttonByText(wrapper, 'Revertir')).toBeUndefined()
    })

    it('opens the register dialog with the selected row', async () => {
      mockWithCheques([chequeRow()])
      const wrapper = await mounted()
      await openMarkDialog(wrapper)
      expect(markDialogOpen(wrapper)).toBe(true)
      expect(body().text()).toContain('Registrar pago con cheque')
    })

    it('posts the mark payload, closes the dialog and reloads on success', async () => {
      mockWithCheques([chequeRow()])
      mockAxiosPost.mockResolvedValue({ data: { res: true, data: { refrend_id: 10 } } })
      const wrapper = await mounted()
      const getsBefore = mockAxiosGet.mock.calls.length
      await submitMark(wrapper)

      expect(mockAxiosPost).toHaveBeenCalledWith(
        'api/admin/scholarship-payments/10/cheque-payment',
        expect.objectContaining({ cheque_number: 'CH-100' }),
      )
      expect(markDialogOpen(wrapper)).toBe(false)
      expect(mockAxiosGet.mock.calls.length).toBeGreaterThan(getsBefore)
    })

    it.each([
      ['already_paid', 409, 'ALREADY_PAID'],
      ['cycle_closed', 409, 'CYCLE_CLOSED'],
      ['telmex_repayment_exists', 409, 'TELMEX_REPAYMENT_EXISTS'],
      ['not_cheque', 422, 'NOT_CHEQUE_METHOD'],
    ])('closes the register dialog on %s', async (_name, status, code) => {
      mockWithCheques([chequeRow()])
      mockAxiosPost.mockRejectedValue(apiError(status, { res: false, msg: 'Mensaje del servidor', code }))
      const wrapper = await mounted()
      await submitMark(wrapper)
      expect(markDialogOpen(wrapper)).toBe(false)
    })

    it('keeps the register dialog open and shows the taken-number error inline', async () => {
      mockWithCheques([chequeRow()])
      mockAxiosPost.mockRejectedValue(
        apiError(422, { res: false, msg: 'Ese número de cheque ya fue registrado.', code: 'CHEQUE_NUMBER_TAKEN' }),
      )
      const wrapper = await mounted()
      await submitMark(wrapper)
      expect(markDialogOpen(wrapper)).toBe(true)
      expect(body().text()).toContain('Ese número de cheque ya fue registrado.')
    })

    it('keeps the register dialog open and shows validation errors inline', async () => {
      mockWithCheques([chequeRow()])
      mockAxiosPost.mockRejectedValue(
        apiError(422, { message: 'invalid', errors: { cheque_notes: ['Las notas son demasiado largas'] } }),
      )
      const wrapper = await mounted()
      await submitMark(wrapper)
      expect(markDialogOpen(wrapper)).toBe(true)
      expect(body().text()).toContain('Las notas son demasiado largas')
    })

    it.each([
      ['not_payable', 422, 'NOT_PAYABLE'],
      ['error', 500, 'SERVER_ERROR'],
    ])('keeps the register dialog open on %s', async (_name, status, code) => {
      mockWithCheques([chequeRow()])
      mockAxiosPost.mockRejectedValue(
        apiError(status, { res: false, msg: 'Mensaje del servidor', code, data: { reasons: [] } }),
      )
      const wrapper = await mounted()
      await submitMark(wrapper)
      expect(markDialogOpen(wrapper)).toBe(true)
    })

    it('posts the revert reason and closes the dialog on success', async () => {
      mockWithCheques([paidChequeRow()])
      mockAxiosPost.mockResolvedValue({ data: { res: true, data: { refrend_id: 11 } } })
      const wrapper = await mounted()
      await submitRevert(wrapper)

      expect(mockAxiosPost).toHaveBeenCalledWith('api/admin/scholarship-payments/11/cheque-payment/revert', {
        reason: 'Cheque emitido por error',
      })
      expect(revertDialogOpen(wrapper)).toBe(false)
    })

    it.each([
      ['cycle_closed', 409, 'CYCLE_CLOSED'],
      ['telmex_repayment_exists', 409, 'TELMEX_REPAYMENT_EXISTS'],
      ['not_cheque', 422, 'NOT_CHEQUE_PAID'],
    ])('closes the revert dialog on %s', async (_name, status, code) => {
      mockWithCheques([paidChequeRow()])
      mockAxiosPost.mockRejectedValue(apiError(status, { res: false, msg: 'Mensaje del servidor', code }))
      const wrapper = await mounted()
      await submitRevert(wrapper)
      expect(revertDialogOpen(wrapper)).toBe(false)
    })

    it('keeps the revert dialog open on a generic error', async () => {
      mockWithCheques([paidChequeRow()])
      mockAxiosPost.mockRejectedValue(apiError(422, { res: false, msg: 'Falta el registro', code: 'CHEQUE_LOG_MISSING' }))
      const wrapper = await mounted()
      await submitRevert(wrapper)
      expect(revertDialogOpen(wrapper)).toBe(true)
    })
  })
})
