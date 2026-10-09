// Pure grouping/header helpers for Lotes de pago's "grouped by generación"
// requirement (sdd/lotes-pago-generacion-desglose, spec "Rows grouped by
// generación with paid/unpaid header", design D1-D4). PaymentBatchTable.vue
// stays presentational — this module owns the ordering decision and the
// header text, same "pure module, SFC only renders" split as
// paymentBreakdownMeta.ts.
//
// Installed Vuetify (4.2.0) gives a group whose `value == null` NO header
// row and keeps it always-expanded (design, verified against
// node_modules/vuetify's group.js) — so `item.value ?? 'Sin generación'`
// (psicol-panel's AprobacionRefrendTable.vue precedent) is dead code there.
// We avoid that trap by mapping every row to a non-null `generation_group`
// key up front, using NO_GENERATION_KEY as the sentinel for a null/empty
// snapshot_generation.

export const NO_GENERATION_KEY = '__sin_generacion__'

export interface GenerationGroupRowFields {
  snapshot_generation: string | null
}

export type GroupedItem<T> = T & { generation_group: string }

const collator = new Intl.Collator('es', { numeric: true })

const groupKey = (row: GenerationGroupRowFields): string => row.snapshot_generation ?? NO_GENERATION_KEY

/**
 * `NO_GENERATION_KEY` -> "Sin generación". Any other key is already the
 * display label (the raw `snapshot_generation` string, e.g. "Generación 9").
 */
export function generationLabel(key: string): string {
  return key === NO_GENERATION_KEY ? 'Sin generación' : key
}

/**
 * Numeric collator ("Generación 19" sorts after "Generación 9", unlike a
 * plain string compare) — the sentinel group ALWAYS sorts last, regardless
 * of where its label would otherwise fall (design D3).
 */
function compareGroupKeys(a: string, b: string): number {
  if (a === b) return 0
  if (a === NO_GENERATION_KEY) return 1
  if (b === NO_GENERATION_KEY) return -1
  return collator.compare(a, b)
}

/**
 * Maps each row to its `generation_group` key and stable-sorts the whole
 * list by that key — rows within the same generación keep the server's
 * original order (design D3: "then server name order"). `disable-sort`
 * on the table relies on this pre-sorted order being final.
 */
export function toGroupedItems<T extends GenerationGroupRowFields>(rows: T[]): GroupedItem<T>[] {
  return rows
    .map((row, index) => ({ item: { ...row, generation_group: groupKey(row) }, index }))
    .sort((a, b) => compareGroupKeys(a.item.generation_group, b.item.generation_group) || a.index - b.index)
    .map(({ item }) => item)
}

export interface PaidPredicateRowFields {
  payment_batch_id: number | null
  status: string
}

export interface GroupHeaderRowFields extends GenerationGroupRowFields, PaidPredicateRowFields {
  is_payable: boolean
  total_to_pay: string
}

// Same paid predicate as PaymentBatchService::partitionGroup
// (payment_batch_id !== null || status === 'PAID') — reused here per the
// approved amendment, not a new invented predicate (spec risk note).
const isPaidRow = (row: PaidPredicateRowFields): boolean => row.payment_batch_id !== null || row.status === 'PAID'

const formatAmount = (amount: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

const becarioCount = (total: number): string => `${total} becario${total === 1 ? '' : 's'}`

/**
 * Builds the group-header text for every generación present in
 * `sourceRows` — ALWAYS computed from the FULL batch rows, never a
 * filtered/visible subset (spec invariant: group counts/sums must not
 * change when "Solo pendientes de revisar" is toggled).
 *
 * Unpaid batches (`isPaid` false): "{label} — N becarios (M listos) — $X a
 * pagar", X = Σ total_to_pay of is_payable rows.
 * Paid batches (`isPaid` true): "{label} — N becarios — $Y pagado", Y = Σ
 * total_to_pay of rows matching the paid predicate above — never "(M
 * listos)" nor "$0.00 a pagar" in this state (amendment).
 *
 * A key absent from this map (e.g. looked up against a group that isn't in
 * `sourceRows`) has no header here — callers fall back to
 * `generationLabel(key)` alone.
 */
export function buildGroupHeaders(sourceRows: GroupHeaderRowFields[], isPaid: boolean): Map<string, string> {
  const groups = new Map<string, GroupHeaderRowFields[]>()

  for (const row of sourceRows) {
    const key = groupKey(row)
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }

  const headers = new Map<string, string>()

  for (const [key, rows] of groups) {
    const label = generationLabel(key)
    const total = rows.length

    if (isPaid) {
      const paidTotal = rows.filter(isPaidRow).reduce((sum, row) => sum + Number(row.total_to_pay), 0)
      headers.set(key, `${label} — ${becarioCount(total)} — ${formatAmount(paidTotal)} pagado`)
      continue
    }

    const payableRows = rows.filter((row) => row.is_payable)
    const payableTotal = payableRows.reduce((sum, row) => sum + Number(row.total_to_pay), 0)
    headers.set(
      key,
      `${label} — ${becarioCount(total)} (${payableRows.length} listos) — ${formatAmount(payableTotal)} a pagar`,
    )
  }

  return headers
}
