// Becas Telmex — coverage domain types (sdd/telmex-cobertura-iu, PR4).
// Mirrors AdministrationRole's isolation comment style: these shapes match
// the PR3b contract described in design #1920 — NOT yet verified against a
// live backend (PR3a/PR3b land in a parallel batch). Any field here is a
// contract ASSUMPTION unless noted; flagged explicitly in the apply report.

export type TelmexCoverageStatus = 'ACTIVA' | 'EN_COBRO' | 'LIQUIDADA' | 'CANCELADA'

export type TelmexCoverageScholarshipType = 'TELMEX' | 'TELMEX_IU'

// One row of the Becas Telmex list (GET /api/admin/telmex-coverages). Carries
// enough becario context (name/campus/generation) to render the list's
// columns without a second request per row — mirrors PaymentBatchRow's
// denormalized-for-display precedent (interfaces/payment.ts).
export interface TelmexCoverage {
  id: number
  user_id: number
  becario_name: string
  campus: string
  generation: string | null
  scholarship_type_at_activation: TelmexCoverageScholarshipType
  status: TelmexCoverageStatus
  start_period: string
  end_period: string | null
  notes: string | null
  cancel_reason: string | null
  // Money comes from the API as 2-decimal strings (number_format), same
  // convention as every money field in payment.ts — convert with Number()
  // before comparing or doing arithmetic.
  advanced: string
  repaid: string
  balance: string
  // Drives the REACTIVATE action's visibility client-side (decisions-2 #1921
  // dec3: reactivation allowed only if no covered month was ever paid). The
  // backend is the source of truth for the 422 guard; this flag only toggles
  // whether the button is offered at all.
  has_paid_covered_month: boolean
  created_at: string
  updated_at: string
}

// GET /api/admin/telmex-coverages/eligible — TELMEX/TELMEX_IU becarios with
// no non-CANCELADA coverage yet (spec: "Coverage record, scope and
// uniqueness"), feeding ActivateCoverageDialog's becario picker.
export interface EligibleTelmexBecario {
  id: number
  name: string
  campus: string
  generation: string | null
  scholarship_type: TelmexCoverageScholarshipType
}

// GET /api/admin/telmex-coverages/{coverage} — PR5 (TelmexCoverageDetailView)
// consumes this; defined here so the store's full API surface lands in one
// PR4 file per tasks #1922 (4.2) instead of PR5 re-touching this store.
export interface TelmexCoveragePayment {
  id: number
  coverage_id: number
  amount: string
  paid_at: string
  reference: string | null
  notes: string | null
  is_voided: boolean
  voided_at: string | null
  void_reason: string | null
  created_at: string
}

export interface TelmexCoverageMonth {
  period: string
  covered_amount: number
  is_paid: boolean
  payment_batch_id: number | null
  // True when the covered month also paid a temporary increase (IU money,
  // not part of the debt). Sent by GET telmex-coverages/{coverage}.
  has_temporary_increase?: boolean
}

export interface TelmexCoverageStatement {
  coverage: TelmexCoverage
  months: TelmexCoverageMonth[]
  payments: TelmexCoveragePayment[]
}

export interface ActivateTelmexCoveragePayload {
  user_id: number
  start_period: string
  notes?: string
}

export interface EndTelmexCoveragePayload {
  telmex_start_period: string
}

export interface CancelTelmexCoveragePayload {
  reason: string
}

// `paid_at` is OPTIONAL (confirmed against PR3b's final, implemented
// contract: `POST {coverage}/payments {amount, paid_at?, reference?,
// notes?}` — the server defaults it when omitted).
export interface RegisterTelmexCoveragePaymentPayload {
  amount: number
  paid_at?: string
  reference?: string
  notes?: string
}

export interface VoidTelmexCoveragePaymentPayload {
  void_reason: string
}
