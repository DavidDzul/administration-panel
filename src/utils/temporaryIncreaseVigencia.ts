// Shared, pure vigencia/display helper for the scholarship-profile temporary
// increase (sdd/temporary-increase-visibility, design D1). Both
// PaymentDataDialog.vue and PaymentDataCard.vue need identical 3-state logic
// → extracted once. Mirrors the frozen-catalog + pure-fn precedent of
// resolutionMeta.ts/advancePaymentMeta.ts/telmexExportMeta.ts: no reactive
// state, lives in utils/, not composables/.
export type VigenciaState = 'VIGENTE' | 'PROGRAMADO' | 'EXPIRADO' | 'SIN_RANGO'

export interface TemporaryIncreaseFields {
  temporary_increase_amount: string | null
  temporary_increase_valid_from: string | null
  temporary_increase_valid_until: string | null
  temporary_increase_reason: string | null
}

export interface TemporaryIncreaseDisplay {
  amount: string
  range: string
  reason: string | null
  state: VigenciaState
  stateLabel: string
  stateColor: string
}

interface VigenciaMeta {
  label: string
  color: string
}

const VIGENCIA_LABELS: Readonly<Record<VigenciaState, VigenciaMeta>> = Object.freeze({
  VIGENTE: { label: 'Vigente', color: 'success' },
  PROGRAMADO: { label: 'Programado', color: 'info' },
  EXPIRADO: { label: 'Expirado', color: 'grey' },
  SIN_RANGO: { label: 'Sin vigencia', color: 'warning' },
})

// Laravel `date` cast serializes as "2026-10-01T00:00:00.000000Z". Slicing
// to the first 10 chars is MANDATORY (design D2): `new Date(iso)` + local
// getters (getDate()/getMonth()/getFullYear(), toLocaleDateString()) in a
// UTC-6 context resolve that instant to the PREVIOUS calendar day — a silent
// off-by-one on both range bounds. String slicing is TZ-independent and
// never constructs a Date from the ISO value.
const dateOnly = (iso: string | null): string | null => (iso === null || iso.length < 10 ? null : iso.slice(0, 10))

// Local calendar date, NOT toISOString() (which is UTC and rolls over after
// 18:00 CST). Mirrors the backend's Carbon::today() app-timezone semantics.
const todayLocal = (): string => {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// DD/MM/YYYY, no `Date` round-trip — operates on the already-sliced
// YYYY-MM-DD string.
const formatDate = (ymd: string): string => ymd.split('-').reverse().join('/')

const formatAmount = (raw: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(raw)

/**
 * Mirrors ScholarshipProfile::isTemporaryIncreaseActiveOn() +
 * rangeCoversDate() exactly: amount !== null && (float) amount > 0 &&
 * from !== null && until !== null && on >= from && on <= until (both ends
 * INCLUSIVE, date-only). A null bound means "inactive", never "unbounded" —
 * same as rangeCoversDate()'s early `return false`. Display-only — never
 * feeds a money calculation.
 */
export function temporaryIncreaseDisplay(fields: TemporaryIncreaseFields): TemporaryIncreaseDisplay | null {
  // decimal:2 arrives as a STRING — Number() coercion is required, and the
  // isFinite guard keeps a malformed value from rendering "$NaN".
  const raw = Number(fields.temporary_increase_amount ?? 0)
  if (!Number.isFinite(raw) || raw <= 0) return null

  const from = dateOnly(fields.temporary_increase_valid_from)
  const until = dateOnly(fields.temporary_increase_valid_until)
  const on = todayLocal()

  const state: VigenciaState =
    from === null || until === null ? 'SIN_RANGO' : on >= from && on <= until ? 'VIGENTE' : on < from ? 'PROGRAMADO' : 'EXPIRADO'

  const meta = VIGENCIA_LABELS[state]

  return {
    amount: formatAmount(raw),
    range: from !== null && until !== null ? `${formatDate(from)} — ${formatDate(until)}` : 'Sin rango definido',
    reason: fields.temporary_increase_reason,
    state,
    stateLabel: meta.label,
    stateColor: meta.color,
  }
}
