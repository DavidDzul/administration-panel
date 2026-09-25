// Matches PaymentReadinessEvaluator/PaymentBatchService's PaymentBatchRow
// shape (design's "one shared row shape" interface, verified against
// ScholarshipPaymentController@index/process directly) — server-owned copy,
// the UI never composes readiness strings itself. `outcome`/`outcome_reason`
// stay null pre-payment and are populated only by the process() response.
export interface BlockingReason {
  code: string
  message: string
}

export interface PaymentBatchRow {
  refrend_id: number
  user_id: number
  snapshot_name: string
  enrollment: string | null
  bank_name: string | null
  account_number: string | null
  total_to_pay: string
  is_payable: boolean
  blocking_reasons: BlockingReason[]
  outcome: 'PAID' | 'SKIPPED' | null
  outcome_reason: string | null
  // Quick-glance flags added by impulsou-api commit eba5c3d
  // (PaymentBatchService::rows(), verified batched — no N+1). Purely
  // informational: incidencias never block payment, and a withheld amount
  // settled from a previous period is a normal, expected state — neither
  // flag participates in `is_payable`/`blocking_reasons`.
  has_incident: boolean
  has_pending_from_previous: boolean
  // True only when the current month pays nothing and this payment settles
  // solely a retained prior month — distinguishes that from the normal case
  // (current month paid + a retained month settled alongside it), which
  // has_pending_from_previous alone can't tell apart.
  only_pending_from_previous: boolean
  // Row-level resolution indicator (sdd/resolution-status-visibility).
  // Purely informational, same as the flags above — NEVER participates in
  // `is_payable`/`blocking_reasons` (PaymentReadinessEvaluator is
  // structurally unreachable by these two fields). Typed as `string | null`,
  // not the `ResolutionType` union, because this is server data that must
  // survive an unknown value — the union + fallback lives in
  // `@/utils/resolutionMeta`.
  resolution_type: string | null
  resolution_cause: string | null
  // Advance-paid row indicator (sdd/pago-adelantado, design D6/PR7b).
  // Purely informational, same invariant as the flags above — NEVER
  // participates in `is_payable`/`blocking_reasons` (PaymentReadinessEvaluator
  // does not read these fields). Verified against
  // PaymentBatchService::rows() directly (impulsou-api PR5) — deliberately
  // NOT present in `paidRows()`'s row shape (explicit scope boundary,
  // mirrors resolution_type/resolution_cause's own exclusion from that
  // method). `advance_paid_amount` is a Laravel `number_format(...,2)`
  // string, same convention as `total_to_pay`, and is `null` (never
  // `"0.00"`) when `advance_paid` is `false`.
  advance_paid: boolean
  advance_paid_amount: string | null
  advance_paid_origin_year: number | null
  advance_paid_origin_month: number | null
  // Origin-refrend "advance payment registered" indicator (sdd/pago-adelantado
  // PR8). OPPOSITE meaning from the advance_paid family above: advance_paid
  // means "this row IS one of the future months settled by an advance batch
  // made from some OTHER refrend" (this row is a CHILD). advance_payment_amount
  // means "this row itself HAS an advance-payment batch registered FROM it"
  // (this row is the ORIGIN refrend) — its total_to_pay already includes this
  // amount (design D6). Both can be true on different rows in the same batch
  // simultaneously; never conflate them. Purely informational, same invariant
  // as the flags above — NEVER participates in `is_payable`/`blocking_reasons`.
  // Verified against PaymentBatchService::rows() directly (impulsou-api PR8) —
  // a Laravel `number_format(...,2,'.','')` string, `"0.00"` (never null) when
  // the refrend has no advance payment registered against it.
  advance_payment_amount: string
}

// Matches PaymentBatchService::summary()'s real keys, verified against
// ScholarshipPaymentControllerTest's assertions
// (`summary.total/ready/blocking/total_amount`).
export interface PaymentBatchSummary {
  total: number
  ready: number
  blocking: number
  total_amount: string
}

// The batch identity posted to both GET (query params) and POST /process
// (body) — the server always re-derives membership from this key, never
// trusts a client-supplied ids[] (design D2).
export interface BatchKey {
  generation_id: number
  campus: string
  period_year: number
  period_month: number
}

// Matches ScholarshipPaymentController::index()'s new `data.batch` block
// (design D3, sdd/becario-payment-bank-file-export) — derived server-side
// from the row-level `payment_batch_id` already SELECTed by
// PaymentBatchService::rows(). `batch_id` is null unless the batch key is
// already fully paid; this is what lets the SPA reach the export action
// after a page reload instead of relying on the transient `batchId` set by
// processBatch().
export interface PaymentBatchBlock {
  batch_id: number | null
  is_paid: boolean
}

// Matches ScholarshipPaymentController::exportSummary()'s real envelope
// (design D4) — count/total are sourced from the SAME
// PaymentBatchService::paidRows() + BankDataValidator gate export() uses, so
// this can never promise a total the file endpoint fails to deliver.
// `filename` is server-owned (BankPaymentFileName::forBatch(), design D5) —
// the SPA never composes it.
export interface ExportSummary {
  count: number
  total_amount: string
  filename: string
}

// Matches BankDataValidator::validate()'s per-row rejection shape.
export interface BankFileReason {
  code: string
  message: string
}

// Matches the 422 `data.invalid_rows[]` shape shared by BOTH export
// endpoints (design D4's invariant — one gate, two callers), verified
// against ScholarshipPaymentController::paidAndBankValidatedRows().
export interface InvalidBankRow {
  refrend_id: number
  snapshot_name: string
  account_number: string | null
  rfc: string | null
  reasons: BankFileReason[]
}

// Matches ScholarshipPaymentController::document()'s real response, verified
// by reading impulsou-api/app/Http/Controllers/Admin/ScholarshipPaymentController.php
// directly (PR6) rather than guessing. `incident_category`/`incident_type`
// are plain strings on ScholarshipRefrendIncident (no cast/enum), and
// `is_resolved` is the model's real `boolean` cast.
export interface PaymentDocumentIncident {
  id: number
  incident_category: string
  incident_type: string
  description: string
  is_resolved: boolean
}

// All money/percentage fields are Laravel `decimal:2` casts, which serialize
// as STRINGS (verified against ScholarshipRefrend.php's $casts and the
// controller feature test's `assertSame('1000.00', ...)` assertions) — never
// numbers, same convention as PaymentBatchRow.total_to_pay.
export interface PaymentAmountBreakdown {
  base_amount: string
  discount_percentage: string
  discount_amount: string
  amount_pending_from_previous: string
  refund_amount_from_previous: string
  final_amount: string
  total_to_pay: string
}

// Matches `RefrendRetentionBreakdown::forRefrend()`'s real response shape
// (sdd/withholding-detail-display PR1/PR2, verified against
// `ScholarshipPaymentControllerTest`'s `document(): retentions` assertions —
// see apply-progress for the exact field names, not guessed). Kind 1a: money
// settled NOW by this refrend, from earlier periods.
export interface RetentionLedgerEntry {
  payment_id: number
  withholding_id: number
  period_year: number
  period_month: number
  withheld_amount: string
  amount_applied_now: string
  remaining_amount: string
  cause: string | null
  withheld_at: string
  applied_at: string
  created_by: string | null
}

// Kind 1b: the retention THIS refrend generated, if any (D2 — `CANCELLED`
// origins never surface here, so this and `definitive_discount` are mutually
// exclusive for the same refrend). Object-or-null cardinality is structural,
// not incidental (`origin_refrend_id` is uniquely indexed) — D3.
export interface OriginWithholding {
  withholding_id: number
  period_year: number
  period_month: number
  withheld_amount: string
  paid_amount: string
  remaining_amount: string
  status: 'PENDING' | 'PAID'
  cause: string | null
  withheld_at: string
  created_by: string | null
}

// Kind 2: attendance-driven discount. Deliberately has NO amount field — the
// column does not exist on `scholarship_refrend_discounts`, so the frontend
// must never synthesize a peso value for this kind (D-note in design).
export interface AttendanceDiscount {
  id: number
  discount_type: 'RETARDOS' | 'FALTA_INJUSTIFICADA'
  discount_percentage: string | null
  description: string | null
  created_at: string
}

// Kind 3: definitive discount. Object-or-null (columns live directly on the
// refrend, not a related table — D3), and deliberately has no date field
// (spec's resolved scope correction: no decision-date requirement exists).
export interface DefinitiveDiscount {
  discount_amount: string
  discount_percentage: string
  resolution_cause: string | null
}

// Ties the three retention kinds together under one key (D4) so the frontend
// has a single typed shape instead of three loose optional fields scattered
// across `PaymentDocument`. `ledger_applied_total` must equal
// `amount_breakdown.amount_pending_from_previous` (the reconciliation
// invariant enforced server-side).
export interface RetentionBreakdown {
  ledger_applied: RetentionLedgerEntry[]
  ledger_applied_total: string
  origin_withholding: OriginWithholding | null
  attendance_discounts: AttendanceDiscount[]
  definitive_discount: DefinitiveDiscount | null
}

// The 3 comentario fields (atencion_observations/pedagogia_observations/
// resolution_notes) are kept SEPARATE per the spec's resolved decision — this
// interface mirrors that, they are never merged into one field client-side.
// `carryover_percentage` was removed end-to-end in
// sdd/withholding-detail-display PR3 (dead column, no write path anywhere).
export interface PaymentDocument {
  refrend_id: number
  user_id: number
  enrollment: string | null
  snapshot_name: string
  incidents: PaymentDocumentIncident[]
  carryover_months_count: number | null
  carryover_months_detail: string | null
  atencion_observations: string | null
  pedagogia_observations: string | null
  resolution_notes: string | null
  amount_breakdown: PaymentAmountBreakdown
  retentions: RetentionBreakdown
}
