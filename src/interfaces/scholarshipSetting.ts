// Matches `App\Models\ScholarshipSetting`'s real shape
// (sdd/scholarship-telmex-iu-split, design D8) — single-row (id=1) typed
// settings table. `telmex_base_amount` is a Laravel `decimal:2` cast, so it
// serializes as a STRING, same convention as every other money field in this
// codebase (see payment.ts's PaymentBatchRow.total_to_pay header note).
// Reference-only: this value is NEVER read by buildSnapshot(), validation,
// or any auto-fill logic — it exists purely as an informational hint.
export interface ScholarshipSetting {
  id: number
  telmex_base_amount: string
}

// Submission shape for `PUT admin/scholarship-settings`. Real `number` (not
// string) — the settings form's numeric input binds via `v-model.number`,
// same convention as ScholarshipProfileConfigForm.
export interface ScholarshipSettingForm {
  telmex_base_amount: number
}
