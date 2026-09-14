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
