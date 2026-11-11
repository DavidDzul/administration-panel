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

// "REF-1 / REF-2" (Beca then Apoyo) for table cells and dialogs.
export const joinReferences = (payments: ManualPayment[] | undefined): string =>
  (payments ?? []).map((payment) => payment.reference).join(' / ')
