// Design D5 (sdd/scholarship-profile-config-to-admin): only the 5
// admin-editable config fields are typed here. The real GET
// `scholarship-profiles/{userId}` response carries many more
// ScholarshipProfile columns (reticula, discount, temporary increase, etc.)
// — those are structurally ignored, not modeled, since administration-panel
// never reads or writes them.
//
// `TELMEX_IU` and `iu_payment_amount` added by sdd/scholarship-telmex-iu-split
// (design D2/D7, spec "TELMEX_IU scholarship type"/"iu_payment_amount field").
// `iu_payment_amount` is a Laravel `decimal:2` cast, serializes as a STRING,
// same convention as monthly_amount/monto_apoyo — `null` whenever
// scholarship_type isn't TELMEX_IU (backend `exclude_unless` nulls it on
// switch-away, see ScholarshipProfileController::updateConfig()).
export interface ScholarshipProfileConfig {
  scholarship_type: 'IU' | 'TELMEX' | 'TELMEX_IU'
  monthly_amount: string
  monto_apoyo: string | null
  advance_payment_eligible: boolean
  iu_payment_amount: string | null
  // Read-only (sdd/temporary-increase-visibility). GET
  // scholarship-profiles/{userId} already returns the whole model, so these
  // 4 fields arrive today — administration-panel simply never typed them.
  // NEVER sent back: ScholarshipProfileConfigForm and
  // UpdateScholarshipProfileConfigRequest stay byte-for-byte unchanged.
  // `_amount` is a `decimal:2` cast -> STRING. `_valid_from`/`_valid_until`
  // are `date` casts -> ISO datetime strings with a bogus 00:00:00Z time
  // component (see utils/temporaryIncreaseVigencia.ts for the safe way to
  // read them).
  temporary_increase_amount: string | null
  temporary_increase_valid_from: string | null
  temporary_increase_valid_until: string | null
  temporary_increase_reason: string | null
}

// Submission shape for `PUT scholarship-profiles/{userId}/config`. Numeric
// fields are real `number`s here (not strings) — the dialog's numeric
// inputs bind directly to these via `v-model.number`. `iu_payment_amount` is
// always sent as a number (defaulting 0), same convention as monto_apoyo —
// the backend's `exclude_unless:scholarship_type,TELMEX_IU` rule silently
// drops it from the validated payload when the type isn't TELMEX_IU, so
// sending a harmless 0 for non-TELMEX_IU profiles is safe.
export interface ScholarshipProfileConfigForm {
  scholarship_type: 'IU' | 'TELMEX' | 'TELMEX_IU'
  monthly_amount: number
  monto_apoyo: number
  advance_payment_eligible: boolean
  iu_payment_amount: number
}
