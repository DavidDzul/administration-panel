// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VSelect, VBtn, VSwitch } from 'vuetify/components'
import type { Generation } from '@/interfaces/generation'
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

const buildGeneration = (overrides: Partial<Generation> = {}): Generation => ({
  id: 1,
  campus: 'MERIDA',
  generation_active: true,
  generation_name: 'Generación 1',
  ...overrides,
})

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
  await selectByLabel(wrapper, 'Generación')?.vm.$emit('update:modelValue', 1)
  await selectByLabel(wrapper, 'Año')?.vm.$emit('update:modelValue', 2026)
  await selectByLabel(wrapper, 'Mes')?.vm.$emit('update:modelValue', 9)
  await flushPromises()
}

const grantPermissions = (canProcess: boolean, canExport = false): void => {
  const permissions = ['ADM_READ_PAYMENTS']
  if (canProcess) permissions.push('ADM_PROCESS_PAYMENTS')
  if (canExport) permissions.push('ADM_EXPORT_PAYMENTS')
  useAuthStore().permissions = permissions
}

const mockGenerationsAndBatch = (
  rows: PaymentBatchRow[],
  summary: Record<string, unknown>,
  batch: Record<string, unknown> = { batch_id: null, is_paid: false },
): void => {
  mockAxiosGet.mockImplementation((url: string) => {
    if (url === 'api/admin/generations') {
      return Promise.resolve({ data: { res: true, generations: [buildGeneration()] } })
    }
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
    mockGenerationsAndBatch([buildRow()], { total: 1, ready: 1, blocking: 0, total_amount: '1000.00' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not fetch the batch or show a table until all 4 filters are chosen', async () => {
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
        params: { generation_id: 1, campus: 'MERIDA', period_year: 2026, period_month: 9 },
      }),
    )
    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('1') // total becarios
  })

  it('shows the readiness chip and the specific blocking reason per row', async () => {
    mockGenerationsAndBatch(
      [
        buildRow({ refrend_id: 1, snapshot_name: 'Ada Lovelace', is_payable: true }),
        buildRow({
          refrend_id: 2,
          snapshot_name: 'Grace Hopper',
          is_payable: false,
          blocking_reasons: [{ code: 'MISSING_ENROLLMENT', message: 'Sin matrícula registrada' }],
        }),
      ],
      { total: 2, ready: 1, blocking: 1, total_amount: '1000.00' },
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
    mockGenerationsAndBatch(
      [buildRow({ refrend_id: 1, is_payable: true }), buildRow({ refrend_id: 2, is_payable: false })],
      { total: 2, ready: 1, blocking: 1, total_amount: '1000.00' },
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
      generation_id: 1,
      campus: 'MERIDA',
      period_year: 2026,
      period_month: 9,
      expected_count: 1,
      expected_total: '1000.00',
    })
  })

  it('opens the payment document dialog for the clicked row instead of navigating away (sdd/becario-payment-batch-indicators)', async () => {
    mockAxiosGet.mockImplementation((url: string) => {
      if (url === 'api/admin/generations') {
        return Promise.resolve({ data: { res: true, generations: [buildGeneration()] } })
      }
      if (url === 'api/admin/scholarship-payments') {
        return Promise.resolve({
          data: {
            res: true,
            data: { rows: [buildRow({ refrend_id: 3, snapshot_name: 'Ada Lovelace' })], summary: { total: 1, ready: 1, blocking: 0, total_amount: '1000.00' } },
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
              carryover_percentage: null,
              atencion_observations: null,
              pedagogia_observations: null,
              resolution_notes: null,
              amount_breakdown: {
                base_amount: '1000.00',
                discount_percentage: '0.00',
                discount_amount: '0.00',
                amount_pending_from_previous: '0.00',
                refund_amount_from_previous: '0.00',
                final_amount: '1000.00',
                total_to_pay: '1000.00',
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

    const verButton = wrapper.findAllComponents(VBtn).find((b) => b.text() === 'Ver')
    await verButton?.trigger('click')
    await flushPromises()

    expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/scholarship-payments/3/document')
    expect(body().text()).toContain('Documento de pago')
    // The list view (filters/table) stays mounted underneath — no navigation happened.
    expect(wrapper.text()).toContain('Ada Lovelace')
  })

  it('toggling "solo pendientes de revisar" narrows which rows the table receives, without an extra fetch', async () => {
    mockGenerationsAndBatch(
      [
        buildRow({ refrend_id: 1, snapshot_name: 'Ada Lovelace', is_payable: true }),
        buildRow({ refrend_id: 2, snapshot_name: 'Grace Hopper', is_payable: false }),
      ],
      { total: 2, ready: 1, blocking: 1, total_amount: '1000.00' },
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
      exportSummary = { count: 1, total_amount: '1000.00', filename: 'PAGO_1_MERIDA_202609_42.TXT' },
    }: {
      batch?: Record<string, unknown>
      exportSummary?: Record<string, unknown>
    } = {}): void => {
      mockAxiosGet.mockImplementation((url: string) => {
        if (url === 'api/admin/generations') {
          return Promise.resolve({ data: { res: true, generations: [buildGeneration()] } })
        }
        if (url === 'api/admin/scholarship-payments') {
          return Promise.resolve({
            data: {
              res: true,
              data: { rows: [buildRow()], summary: { total: 1, ready: 1, blocking: 0, total_amount: '1000.00' }, batch },
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

      expect(wrapper.text()).toContain('Empleados a Dispersar')
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
        if (url === 'api/admin/generations') {
          return Promise.resolve({ data: { res: true, generations: [buildGeneration()] } })
        }
        if (url === 'api/admin/scholarship-payments') {
          return Promise.resolve({
            data: {
              res: true,
              data: {
                rows: [buildRow()],
                summary: { total: 1, ready: 1, blocking: 0, total_amount: '1000.00' },
                batch: { batch_id: 42, is_paid: true },
              },
            },
          })
        }
        if (url === 'api/admin/scholarship-payments/batches/42/export/summary') {
          return Promise.resolve({
            data: { res: true, data: { count: 1, total_amount: '1000.00', filename: 'PAGO_1_MERIDA_202609_42.TXT' } },
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
})
