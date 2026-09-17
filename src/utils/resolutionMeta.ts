// Catalog for the row-level resolution indicator (sdd/resolution-status-visibility).
// Plain frozen record + pure lookup — no reactive state, so this lives in
// utils/, not composables/ (design D3; mirrors maskAccountNumber.ts's exact
// precedent). Mirrors psicol-panel's statusChip() (useRefrendTableDisplay.ts)
// icon/color choices for 7 of the 8 real resolution_type values (design D2)
// so an admin who has seen psicol-panel's refrendo table reads the same
// glyph for the same state. REEMBOLSO_PARCIAL is the one invention here,
// borrowed from SITUATION_MENU_ITEMS's PAGO_MESES entry (same "money
// flowing back" semantic, the one glyph not already spoken for).
//
// The 8 values are verified against ScholarshipRefrendController.php:334's
// validation rule. PAGO_MESES is deliberately NOT a key here — it is a
// psicol-panel-only action-menu key, never a resolution_type value.
export type ResolutionType =
  | 'BECA_MES'
  | 'SIN_PAGO'
  | 'RETENIDA'
  | 'SUSPENDIDA'
  | 'BAJA_DEFINITIVA'
  | 'EGRESADO'
  | 'REEMBOLSO_PARCIAL'
  | 'DESCUENTO_DEFINITIVO'

export interface ResolutionMeta {
  icon: string
  color: string
  label: string
}

export const RESOLUTION_META: Record<ResolutionType, ResolutionMeta> = {
  BECA_MES: { icon: 'mdi-cash-check', color: 'green', label: 'Pago sin penalización' },
  SIN_PAGO: { icon: 'mdi-cash-remove', color: 'red', label: 'Sin pago' },
  RETENIDA: { icon: 'mdi-lock-outline', color: 'amber-darken-2', label: 'Beca retenida' },
  SUSPENDIDA: { icon: 'mdi-pause-circle-outline', color: 'deep-orange', label: 'Suspensión temporal' },
  BAJA_DEFINITIVA: { icon: 'mdi-account-remove-outline', color: 'red-darken-3', label: 'Baja definitiva' },
  EGRESADO: { icon: 'mdi-account-check-outline', color: 'blue-grey', label: 'Egresado' },
  REEMBOLSO_PARCIAL: { icon: 'mdi-cash-refund', color: 'teal', label: 'Reembolso parcial' },
  DESCUENTO_DEFINITIVO: { icon: 'mdi-cash-minus', color: 'purple-darken-2', label: 'Descuento definitivo' },
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
