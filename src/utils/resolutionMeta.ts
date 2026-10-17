// Catalog for the row-level resolution indicator (sdd/resolution-status-visibility).
// Plain frozen record + pure lookup — no reactive state, so this lives in
// utils/, not composables/ (design D3; mirrors maskAccountNumber.ts's exact
// precedent). Mirrors psicol-panel's statusChip() (useRefrendTableDisplay.ts)
// icon/color choices for the 6 staff-selectable resolution_type values
// so an admin who has seen psicol-panel's refrendo table reads the same
// glyph for the same state.
//
// The 6 staff-selectable values are verified against ScholarshipRefrendController's
// validation rule. PAGO_MESES is deliberately NOT a key here — it is a
// psicol-panel-only action-menu key, never a resolution_type value.
// EGRESO_RETICULA (sdd/egresado-status-timing) is the 9th value: it is
// server-only, written exclusively by GenerateMonthlyRefrendsService for a
// becario's retícula month+2, and deliberately absent from
// ScholarshipRefrendController.php:352's staff-facing whitelist — same
// status as the existing 'BAJA' precedent. It stays a distinct stored value
// from the manual EGRESADO entry above (different icon/color, never
// conflated at the data layer).
export type ResolutionType =
  | 'BECA_MES'
  | 'SIN_PAGO'
  | 'RETENIDA'
  | 'BAJA_DEFINITIVA'
  | 'EGRESADO'
  | 'DESCUENTO_DEFINITIVO'
  | 'EGRESO_RETICULA'

export interface ResolutionMeta {
  icon: string
  color: string
  label: string
}

export const RESOLUTION_META: Record<ResolutionType, ResolutionMeta> = {
  BECA_MES: { icon: 'mdi-cash-check', color: 'green', label: 'Pago sin penalización' },
  SIN_PAGO: { icon: 'mdi-cash-remove', color: 'red', label: 'Sin pago' },
  RETENIDA: { icon: 'mdi-lock-outline', color: 'amber-darken-2', label: 'Beca retenida' },
  BAJA_DEFINITIVA: { icon: 'mdi-account-remove-outline', color: 'red-darken-3', label: 'Baja definitiva' },
  EGRESADO: { icon: 'mdi-account-check-outline', color: 'blue-grey', label: 'Egresado' },
  DESCUENTO_DEFINITIVO: { icon: 'mdi-cash-minus', color: 'purple-darken-2', label: 'Descuento definitivo' },
  EGRESO_RETICULA: { icon: 'mdi-account-clock-outline', color: 'indigo', label: 'Egresado (retícula)' },
}

/**
 * `null` -> no indicator (the row was never resolved through any situation).
 * Unknown/legacy value -> a neutral grey chip carrying the raw value instead
 * of throwing or silently vanishing — a visible prompt to update the catalog
 * if a 9th value is ever added backend-side, rather than a silent gap.
 */
export function resolutionMeta(value: string | null): ResolutionMeta | null {
  if (value === null) return null
  return RESOLUTION_META[value as ResolutionType] ?? { icon: 'mdi-help-circle-outline', color: 'grey', label: value }
}
