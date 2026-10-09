import { describe, expect, it } from 'vitest'
import {
  buildGroupHeaders,
  generationLabel,
  NO_GENERATION_KEY,
  toGroupedItems,
  type GroupHeaderRowFields,
} from '@/utils/paymentGenerationGroups'

// sdd/lotes-pago-generacion-desglose PR2: pure grouping/header helpers for
// Lotes de pago's "grouped by generación" requirement. Vuetify 4.2's
// group-by hides the header row entirely for a group whose `value == null`
// (design D1) — these helpers map null snapshot_generation to a non-null
// sentinel key (NO_GENERATION_KEY) so "Sin generación" always gets a
// visible header, and compute header text/ordering as pure functions the
// table component can trust without re-deriving the paid predicate itself.

const buildRow = (overrides: Partial<GroupHeaderRowFields> = {}): GroupHeaderRowFields => ({
  snapshot_generation: 'Generación 9',
  is_payable: true,
  total_to_pay: '1000.00',
  payment_batch_id: null,
  status: 'DRAFT',
  ...overrides,
})

describe('generationLabel', () => {
  it('maps the sentinel key to "Sin generación"', () => {
    expect(generationLabel(NO_GENERATION_KEY)).toBe('Sin generación')
  })

  it('returns the generación string itself for a real key', () => {
    expect(generationLabel('Generación 9')).toBe('Generación 9')
  })
})

describe('toGroupedItems', () => {
  it('maps a row with a real snapshot_generation to that same generation_group', () => {
    const [item] = toGroupedItems([buildRow({ snapshot_generation: 'Generación 9' })])

    expect(item.generation_group).toBe('Generación 9')
  })

  it('maps a row with null snapshot_generation to NO_GENERATION_KEY', () => {
    const [item] = toGroupedItems([buildRow({ snapshot_generation: null })])

    expect(item.generation_group).toBe(NO_GENERATION_KEY)
  })

  it('orders groups with Intl numeric collator — "Generación 19" sorts after "Generación 9"', () => {
    const rows = [
      buildRow({ snapshot_generation: 'Generación 19' }),
      buildRow({ snapshot_generation: 'Generación 9' }),
    ]

    const items = toGroupedItems(rows)

    expect(items.map((i) => i.generation_group)).toEqual(['Generación 9', 'Generación 19'])
  })

  it('places the "Sin generación" sentinel group last regardless of label sort order', () => {
    const rows = [
      buildRow({ snapshot_generation: null }),
      buildRow({ snapshot_generation: 'Generación 1' }),
      buildRow({ snapshot_generation: 'Zeta' }),
    ]

    const items = toGroupedItems(rows)

    expect(items.map((i) => i.generation_group)).toEqual(['Generación 1', 'Zeta', NO_GENERATION_KEY])
  })

  it('keeps the server order of rows within the same generation group (stable sort)', () => {
    const rows = [
      buildRow({ snapshot_generation: 'Generación 9', total_to_pay: '100.00' }),
      buildRow({ snapshot_generation: 'Generación 9', total_to_pay: '200.00' }),
    ]

    const items = toGroupedItems(rows)

    expect(items.map((i) => i.total_to_pay)).toEqual(['100.00', '200.00'])
  })
})

describe('buildGroupHeaders — unpaid batch', () => {
  it('shows N becarios (M listos) and the payable total', () => {
    const rows = [
      buildRow({ snapshot_generation: 'Generación 9', is_payable: true, total_to_pay: '1000.00' }),
      buildRow({ snapshot_generation: 'Generación 9', is_payable: false, total_to_pay: '500.00' }),
    ]

    const headers = buildGroupHeaders(rows, false)

    expect(headers.get('Generación 9')).toBe('Generación 9 — 2 becarios (1 listo) — $1,000.00 a pagar')
  })

  it('excludes non-payable rows from the payable total', () => {
    const rows = [
      buildRow({ snapshot_generation: 'Generación 1', is_payable: true, total_to_pay: '300.00' }),
      buildRow({ snapshot_generation: 'Generación 1', is_payable: true, total_to_pay: '200.00' }),
      buildRow({ snapshot_generation: 'Generación 1', is_payable: false, total_to_pay: '9999.00' }),
    ]

    const headers = buildGroupHeaders(rows, false)

    expect(headers.get('Generación 1')).toBe('Generación 1 — 3 becarios (2 listos) — $500.00 a pagar')
  })

  it('uses "Sin generación" as the label for the sentinel group', () => {
    const rows = [buildRow({ snapshot_generation: null, is_payable: true, total_to_pay: '400.00' })]

    const headers = buildGroupHeaders(rows, false)

    expect(headers.get(NO_GENERATION_KEY)).toBe('Sin generación — 1 becario (1 listo) — $400.00 a pagar')
  })
})

describe('buildGroupHeaders — paid batch', () => {
  it('shows N becarios and the paid total, with no "(M listos)" and no "$0.00 a pagar"', () => {
    const rows = [
      buildRow({ snapshot_generation: 'Generación 9', payment_batch_id: 42, status: 'PAID', total_to_pay: '1000.00' }),
      buildRow({ snapshot_generation: 'Generación 9', payment_batch_id: null, status: 'PAID', total_to_pay: '500.00' }),
    ]

    const headers = buildGroupHeaders(rows, true)

    const header = headers.get('Generación 9')
    expect(header).toBe('Generación 9 — 2 becarios — $1,500.00 pagado')
    expect(header).not.toContain('listo')
    expect(header).not.toContain('$0.00 a pagar')
  })

  it('sums only rows matching the paid predicate (payment_batch_id set OR status PAID) — partial-paid batch', () => {
    const rows = [
      buildRow({ snapshot_generation: 'Generación 2', payment_batch_id: 7, status: 'DRAFT', total_to_pay: '300.00' }),
      buildRow({ snapshot_generation: 'Generación 2', payment_batch_id: null, status: 'DRAFT', total_to_pay: '9999.00' }),
    ]

    const headers = buildGroupHeaders(rows, true)

    expect(headers.get('Generación 2')).toBe('Generación 2 — 2 becarios — $300.00 pagado')
  })
})

describe('buildGroupHeaders — group absent from source rows', () => {
  it('returns no entry for a key not present in sourceRows; generationLabel still gives a fallback label', () => {
    const rows = [buildRow({ snapshot_generation: 'Generación 9' })]

    const headers = buildGroupHeaders(rows, false)

    expect(headers.has('Generación 1')).toBe(false)
    expect(generationLabel('Generación 1')).toBe('Generación 1')
  })
})
