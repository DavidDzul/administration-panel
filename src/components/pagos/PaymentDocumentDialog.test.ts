// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { VTab } from 'vuetify/components'
import type { PaymentDocument } from '@/interfaces/payment'

// Same jsdom shim as PaymentsView.test.ts / AccesoDetailView.test.ts.
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

// usePaymentDocumentPage is deliberately NOT mocked — same convention as
// PaymentsView.test.ts / AccesosView.test.ts: mocking it would only assert
// the store's internal state changed, never that the real reactive chain
// (store -> composable -> component) actually re-renders. Only the network
// boundary (axiosConfig) is mocked. No router is involved anymore — the
// dialog receives `refrendId` as a prop, not a route param.
const { mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
}))
vi.mock('@/axiosConfig', () => ({
  default: { get: mockAxiosGet },
}))

import PaymentDocumentDialog from '@/components/pagos/PaymentDocumentDialog.vue'

const vuetify = createVuetify()

const buildDocument = (overrides: Partial<PaymentDocument> = {}): PaymentDocument => ({
  refrend_id: 5,
  user_id: 1,
  enrollment: 'MAT-123456',
  snapshot_name: 'Ada Lovelace',
  incidents: [
    {
      id: 1,
      incident_category: 'ACADEMICO',
      incident_type: 'INASISTENCIA',
      description: 'Faltó a clase sin justificación.',
    },
  ],
  carryover_months_count: 2,
  carryover_months_detail: '04/2026: 300.00; 03/2026: 150.00',
  atencion_observations: 'Llegó tarde dos veces.',
  pedagogia_observations: 'Bajo rendimiento en cálculo.',
  resolution_notes: 'Aprobado tras revisión.',
  amount_breakdown: {
    scholarship_type: 'IU',
    base_amount: '1000.00',
    monto_apoyo: null,
    temporary_increase_amount: null,
    temporary_increase_reason: null,
    gross_amount: '1000.00',
    academic_discount_percentage: null,
    academic_discount_reason: null,
    academic_discount_amount: null,
    discount_percentage: '0.00',
    discount_amount: '0.00',
    discount_label: 'Descuentos por penalizaciones',
    telmex_covered_amount: '0.00',
    manual_adjustment: null,
    amount_pending_from_previous: '450.00',
    advance_payment_amount: null,
    final_amount: '1000.00',
    total_to_pay: '1450.00',
  },
  retentions: {
    ledger_applied: [
      {
        payment_id: 10,
        withholding_id: 20,
        period_year: 2026,
        period_month: 3,
        withheld_amount: '450.00',
        amount_applied_now: '450.00',
        remaining_amount: '0.00',
        cause: 'Documentación incompleta',
        withheld_at: '2026-03-05T00:00:00.000000Z',
        applied_at: '2026-04-10T00:00:00.000000Z',
        created_by: 'Ada Lovelace',
      },
    ],
    ledger_applied_total: '450.00',
    origin_withholding: null,
    attendance_discounts: [],
    definitive_discount: null,
  },
  advance_payment: {
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
  },
  ...overrides,
})

const mountDialog = (refrendId: number | null = 5, modelValue = true) =>
  mount(PaymentDocumentDialog, {
    props: { modelValue, refrendId },
    global: { plugins: [vuetify] },
    attachTo: document.body,
  })

const clickTab = async (wrapper: ReturnType<typeof mountDialog>, label: string): Promise<void> => {
  const tab = wrapper.findAllComponents(VTab).find((t) => t.text() === label)
  await tab?.trigger('click')
  await flushPromises()
}

// v-dialog teleports its content to document.body, so `wrapper.text()`/
// `wrapper.find()` (DOM-scoped to the mount root) never see it — same
// convention as PaymentsView.test.ts's `body()` helper for
// ProcessPaymentDialog's teleported content.
const body = () => new DOMWrapper(document.body)

describe('PaymentDocumentDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockAxiosGet.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not fetch anything while closed with no refrendId selected', async () => {
    mountDialog(null, false)
    await flushPromises()

    expect(mockAxiosGet).not.toHaveBeenCalled()
  })

  it('shows a progress indicator while loading, and no document content', async () => {
    mockAxiosGet.mockImplementation(() => new Promise(() => {}))
    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    expect(body().text()).not.toContain('Ada Lovelace')
  })

  it('shows an error alert instead of a broken dialog when the document fails to load', async () => {
    mockAxiosGet.mockRejectedValue(new Error('network error'))
    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(true)
  })

  it('fetches the document for the given refrendId and renders nombre + matrícula in the Resumen tab', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()

    expect(mockAxiosGet).toHaveBeenCalledWith('api/admin/scholarship-payments/5/document')
    expect(body().text()).toContain('Ada Lovelace')
    expect(body().text()).toContain('MAT-123456')
  })

  it('renders incidencias with category, type and description under the Incidencias tab', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()
    await clickTab(wrapper, 'Incidencias')

    expect(body().text()).toContain('Faltó a clase sin justificación.')
    expect(body().text()).toContain('ACADEMICO')
    expect(body().text()).toContain('INASISTENCIA')
  })

  // sdd/verificacion-incidencias-ux PR4b: incidents are never "resolved" in
  // the real workflow, so the old chip read "Pendiente" forever and misled
  // staff into thinking something was still open.
  it('does not show a Resuelta/Pendiente status chip on incidencias', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()
    await clickTab(wrapper, 'Incidencias')

    expect(body().text()).not.toContain('Pendiente')
    expect(body().text()).not.toContain('Resuelta')
  })

  it('renders the 3 comentario fields separately, clearly labeled, never merged into one block', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()
    await clickTab(wrapper, 'Comentarios')

    expect(body().text()).toContain('Atención')
    expect(body().text()).toContain('Llegó tarde dos veces.')
    expect(body().text()).toContain('Pedagogía')
    expect(body().text()).toContain('Bajo rendimiento en cálculo.')
    expect(body().text()).toContain('Resolución')
    expect(body().text()).toContain('Aprobado tras revisión.')
  })

  const breakdownWith = (overrides: Partial<PaymentDocument['amount_breakdown']>): PaymentDocument =>
    buildDocument({ amount_breakdown: { ...buildDocument().amount_breakdown, ...overrides } })

  const openDesglose = async (doc: PaymentDocument) => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: doc } })
    const wrapper = mountDialog()
    await flushPromises()
    await clickTab(wrapper, 'Desglose de monto')
    return wrapper
  }

  const row = (key: string) => body().find(`[data-testid="breakdown-row-${key}"]`)

  it('renders the monto breakdown down to the final total under the Desglose tab', async () => {
    await openDesglose(buildDocument())

    expect(body().text()).toContain('1000.00')
    expect(body().text()).toContain('450.00')
    expect(body().text()).toContain('1450.00')
  })

  it('always shows the subtotals and the total, and hides every zero/null optional row', async () => {
    await openDesglose(buildDocument())

    expect(row('base').exists()).toBe(true)
    expect(row('bruto').text()).toContain('Monto bruto')
    expect(row('bruto').text()).toContain('$1000.00')
    expect(row('final').text()).toContain('Monto final')
    expect(row('total').text()).toContain('Total a pagar')
    expect(row('total').text()).toContain('$1450.00')

    for (const key of ['apoyo', 'aumento', 'academico', 'descuento', 'telmex', 'ajuste', 'adelanto']) {
      expect(row(key).exists(), key).toBe(false)
    }
    // pending is non-zero in the default fixture
    expect(row('pendiente').text()).toContain('+$450.00')
  })

  it('treats "0.00" strings as hidden (truthy string guard)', async () => {
    await openDesglose(
      breakdownWith({
        monto_apoyo: '0.00',
        temporary_increase_amount: '0.00',
        academic_discount_amount: '0.00',
        discount_amount: '0.00',
        telmex_covered_amount: '0.00',
        manual_adjustment: '0.00',
        advance_payment_amount: '0.00',
        amount_pending_from_previous: '0.00',
      }),
    )

    for (const key of ['apoyo', 'aumento', 'academico', 'descuento', 'telmex', 'ajuste', 'adelanto', 'pendiente']) {
      expect(row(key).exists(), key).toBe(false)
    }
    expect(body().text()).not.toContain('undefined')
    expect(body().text()).not.toContain('NaN')
  })

  it('reconciles an IU case with monto de apoyo and a temporary increase, in order', async () => {
    await openDesglose(
      breakdownWith({
        base_amount: '1000.00',
        monto_apoyo: '20.00',
        temporary_increase_amount: '30.00',
        temporary_increase_reason: 'Apoyo transporte',
        gross_amount: '1050.00',
        final_amount: '1050.00',
        amount_pending_from_previous: '0.00',
        total_to_pay: '1050.00',
      }),
    )

    expect(row('base').text()).toContain('$1000.00')
    expect(row('apoyo').text()).toContain('+ Monto de apoyo')
    expect(row('apoyo').text()).toContain('+$20.00')
    expect(row('aumento').text()).toContain('+ Aumento temporal')
    expect(row('aumento').text()).toContain('+$30.00')
    expect(row('aumento').text()).toContain('Motivo: Apoyo transporte')
    expect(row('bruto').text()).toContain('$1050.00')

    const keys = Array.from(body().element.querySelectorAll('[data-testid^="breakdown-row-"]')).map((el) =>
      el.getAttribute('data-testid'),
    )
    expect(keys).toEqual([
      'breakdown-row-base',
      'breakdown-row-apoyo',
      'breakdown-row-aumento',
      'breakdown-row-bruto',
      'breakdown-row-final',
      'breakdown-row-total',
    ])
  })

  it('omits the increase caption when there is no reason', async () => {
    await openDesglose(breakdownWith({ temporary_increase_amount: '30.00', temporary_increase_reason: null }))

    expect(row('aumento').exists()).toBe(true)
    expect(row('aumento').text()).not.toContain('Motivo')
  })

  it('no longer shows the misleading "ya contemplado en el monto base" note', async () => {
    await openDesglose(breakdownWith({ temporary_increase_amount: '30.00', temporary_increase_reason: 'x' }))

    expect(body().text()).not.toContain('ya contemplado')
  })

  it('shows the academic discount with its percentage and reason', async () => {
    await openDesglose(
      breakdownWith({
        academic_discount_percentage: '10.00',
        academic_discount_reason: 'Promedio bajo',
        academic_discount_amount: '100.00',
        final_amount: '900.00',
        total_to_pay: '1350.00',
      }),
    )

    expect(row('academico').text()).toContain('− Descuento académico (10%)')
    expect(row('academico').text()).toContain('−$100.00')
    expect(row('academico').text()).toContain('Motivo: Promedio bajo')
  })

  it('renders the discount_label from the API with the percentage only when it is > 0', async () => {
    await openDesglose(
      breakdownWith({ discount_label: 'Retención', discount_percentage: '25.00', discount_amount: '250.00' }),
    )
    expect(row('descuento').text()).toContain('− Retención (25%)')
    expect(row('descuento').text()).toContain('−$250.00')

    document.body.innerHTML = ''
    await openDesglose(
      breakdownWith({ discount_label: 'Sin pago', discount_percentage: '0.00', discount_amount: '900.00' }),
    )
    expect(row('descuento').text()).toContain('− Sin pago')
    expect(row('descuento').text()).not.toContain('%')
  })

  it('shows the Telmex coverage row', async () => {
    await openDesglose(
      breakdownWith({
        scholarship_type: 'TELMEX_IU',
        base_amount: '600.00',
        gross_amount: '600.00',
        telmex_covered_amount: '1600.00',
        final_amount: '2200.00',
        amount_pending_from_previous: '0.00',
        total_to_pay: '2200.00',
      }),
    )

    expect(row('telmex').text()).toContain('+ Cobertura Telmex')
    expect(row('telmex').text()).toContain('+$1600.00')
  })

  it('shows a negative manual adjustment with an explicit sign, the caption and warning color', async () => {
    await openDesglose(breakdownWith({ manual_adjustment: '-220.00' }))

    const r = row('ajuste')
    expect(r.text()).toContain('± Ajuste manual')
    expect(r.text()).toContain('−$220.00')
    expect(r.text()).toContain('Diferencia por edición manual del monto final')
    expect(r.html()).toContain('text-warning')
  })

  it('shows a positive manual adjustment with a plus sign', async () => {
    await openDesglose(breakdownWith({ manual_adjustment: '900.00' }))

    expect(row('ajuste').text()).toContain('+$900.00')
  })

  it('shows pending and advance payment after the final amount, before the total', async () => {
    await openDesglose(breakdownWith({ advance_payment_amount: '300.00', total_to_pay: '1750.00' }))

    expect(row('pendiente').text()).toContain('+ Pendiente de periodo anterior')
    expect(row('adelanto').text()).toContain('+ Pago adelantado')
    expect(row('adelanto').text()).toContain('+$300.00')
    expect(row('total').text()).toContain('$1750.00')
  })

  it('hides the base row for pure Telmex (base 0) but keeps the subtotals', async () => {
    await openDesglose(
      breakdownWith({
        scholarship_type: 'TELMEX',
        base_amount: '0.00',
        gross_amount: '0.00',
        telmex_covered_amount: '1950.00',
        final_amount: '1950.00',
        amount_pending_from_previous: '0.00',
        total_to_pay: '1950.00',
      }),
    )

    expect(row('base').exists()).toBe(false)
    expect(row('bruto').text()).toContain('$0.00')
    expect(row('final').text()).toContain('$1950.00')
  })

  it('renders no refund column and no "$undefined"/NaN text when the payload lacks refund_amount_from_previous', async () => {
    const document = buildDocument()
    expect(document.amount_breakdown).not.toHaveProperty('refund_amount_from_previous')
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: document } })
    const wrapper = mountDialog()
    await flushPromises()
    await clickTab(wrapper, 'Desglose de monto')

    const text = body().text()
    expect(text).toContain('Pendiente de periodo anterior')
    expect(text).not.toContain('Reembolso')
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('NaN')
  })

  it('renders the retention breakdown panel with the real document.retentions data under the Retenciones tab', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()
    await clickTab(wrapper, 'Retenciones')

    expect(body().text()).toContain('marzo 2026')
    expect(body().text()).toContain('Documentación incompleta')
    expect(body().text()).toContain('Ada Lovelace')
    expect(body().text()).toContain('Total aplicado en este pago')
  })

  it('renders the advance-payment panel with the real document.advance_payment data under the Pago adelantado tab', async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        res: true,
        data: buildDocument({
          advance_payment: {
            settled_as_advance: true,
            origin_period_year: 2026,
            origin_period_month: 9,
            settled_amount: '1200.00',
            settled_status: 'OVERRIDDEN',
            settled_resolution_type: 'BECA_MES',
            divergence_reason: 'Autorizado por dirección.',
            reached_at: '2027-06-15T00:00:00.000000Z',
            has_registered_batch: false,
            registered_months_count: null,
            registered_total_amount: null,
            registered_cause: null,
            registered_notes: null,
          },
        }),
      },
    })
    const wrapper = mountDialog()
    await flushPromises()
    await clickTab(wrapper, 'Pago adelantado')

    expect(body().text()).toContain('septiembre 2026')
    expect(body().text()).toContain('Autorizado por dirección.')
  })

  it('does not render any edit control (read-only dialog)', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()

    expect(body().findAll('input').length).toBe(0)
    expect(body().findAll('textarea').length).toBe(0)
  })

  it('emits update:modelValue false when the close button is clicked', async () => {
    mockAxiosGet.mockResolvedValue({ data: { res: true, data: buildDocument() } })
    const wrapper = mountDialog()
    await flushPromises()

    await body().find('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })
})
