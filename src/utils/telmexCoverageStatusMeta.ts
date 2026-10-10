import type { TelmexCoverageStatus } from '@/interfaces/telmexCoverage'

// Plain frozen record + pure lookup — no reactive state, mirrors
// resolutionMeta.ts's exact precedent (design D3 there, same rationale here:
// status->label/color is a pure mapping, so it lives in utils/, not
// composables/). Status labels per spec's "Lifecycle" requirement
// (ACTIVA/EN_COBRO/LIQUIDADA/CANCELADA); colors chosen distinct per Vuetify's
// semantic palette (info/warning/success/error) so the 4 lifecycle states
// are visually distinguishable at a glance in the list table.
export interface TelmexCoverageStatusMeta {
  label: string
  color: string
}

const TELMEX_COVERAGE_STATUS_META: Record<TelmexCoverageStatus, TelmexCoverageStatusMeta> = {
  ACTIVA: { label: 'Activa', color: 'info' },
  EN_COBRO: { label: 'En cobro', color: 'warning' },
  LIQUIDADA: { label: 'Liquidada', color: 'success' },
  CANCELADA: { label: 'Cancelada', color: 'error' },
}

export function telmexCoverageStatusMeta(status: TelmexCoverageStatus): TelmexCoverageStatusMeta {
  return TELMEX_COVERAGE_STATUS_META[status]
}
