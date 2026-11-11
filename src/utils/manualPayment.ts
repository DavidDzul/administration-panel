import { formatChequeDate } from '@/utils/chequeFormat'
import type { ConceptSplit, ManualPayment, ManualPaymentConcept } from '@/interfaces/payment'

// Fixed display order of the two payment accounts (Beca first, then Apoyo).
export const MANUAL_PAYMENT_CONCEPTS: readonly ManualPaymentConcept[] = ['beca', 'apoyo']

export const CONCEPT_LABEL: Record<ManualPaymentConcept, string> = {
  beca: 'Beca',
  apoyo: 'Apoyo',
}

// A concept only needs a reference when it actually moves money (amount > 0).
export const activeConcepts = (split: ConceptSplit | undefined): ManualPaymentConcept[] =>
  split ? MANUAL_PAYMENT_CONCEPTS.filter((concept) => Number.parseFloat(split[concept]) > 0) : []

// Server field-error key for one concept's reference (Laravel dotted path).
export const referenceErrorKey = (concept: ManualPaymentConcept): string => `references.${concept}`

// "Beca: REF-1 · Apoyo: REF-2 · DD/MM/YYYY" for table cells and dialogs. The
// API orders manual_payments Beca then Apoyo; both share one paid_at.
export const manualPaymentInfo = (payments: ManualPayment[] | undefined): string => {
  if (!payments || payments.length === 0) return ''
  const references = payments.map((payment) => `${CONCEPT_LABEL[payment.concept]}: ${payment.reference}`)
  return [...references, formatChequeDate(payments[0].paid_at)].join(' · ')
}

export const manualPaymentNotes = (payments: ManualPayment[] | undefined): string | null =>
  (payments ?? []).find((payment) => payment.notes)?.notes ?? null
