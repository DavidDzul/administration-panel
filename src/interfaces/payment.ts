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

// The 3 comentario fields (atencion_observations/pedagogia_observations/
// resolution_notes) are kept SEPARATE per the spec's resolved decision — this
// interface mirrors that, they are never merged into one field client-side.
// `carryover_percentage` reads null/0 in practice today (a known,
// separately-tracked backend gap) — this type still reflects the real
// nullable decimal:2 column, not a workaround.
export interface PaymentDocument {
  refrend_id: number
  user_id: number
  enrollment: string | null
  snapshot_name: string
  incidents: PaymentDocumentIncident[]
  carryover_months_count: number | null
  carryover_months_detail: string | null
  carryover_percentage: string | null
  atencion_observations: string | null
  pedagogia_observations: string | null
  resolution_notes: string | null
  amount_breakdown: PaymentAmountBreakdown
}
