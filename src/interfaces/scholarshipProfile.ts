// Design D5 (sdd/scholarship-profile-config-to-admin): only the 4
// admin-editable config fields are typed here. The real GET
// `scholarship-profiles/{userId}` response carries many more
// ScholarshipProfile columns (reticula, discount, temporary increase, etc.)
// — those are structurally ignored, not modeled, since administration-panel
// never reads or writes them.
export interface ScholarshipProfileConfig {
  scholarship_type: 'IU' | 'TELMEX'
  monthly_amount: string
  monto_apoyo: string | null
  advance_payment_eligible: boolean
}

// Submission shape for `PUT scholarship-profiles/{userId}/config`. Numeric
// fields are real `number`s here (not strings) — the dialog's numeric
// inputs bind directly to these via `v-model.number`.
export interface ScholarshipProfileConfigForm {
  scholarship_type: 'IU' | 'TELMEX'
  monthly_amount: number
  monto_apoyo: number
  advance_payment_eligible: boolean
}
