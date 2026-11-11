<template>
  <div>
    <v-text-field
      v-for="concept in concepts"
      :key="concept"
      :model-value="modelValue[concept] ?? ''"
      :label="fieldLabel(concept)"
      :rules="rulesFor(concept)"
      :error-messages="fieldErrors(concept)"
      :data-testid="`reference-${concept}`"
      @update:model-value="onInput(concept, $event)"
    ></v-text-field>
  </div>
</template>

<script setup lang="ts">
// Presentational: one reference input per concept (Beca / Apoyo) whose amount
// is > 0. The Beca/Apoyo names are the ONG payment accounts, shown as labels
// only. Rules: required, max length, and Beca != Apoyo (trim/case-insensitive,
// same rule as the API) so the clash is caught before the request.
import { computed, ref, watch } from 'vue'
import { formatAmount } from '@/utils/paymentBreakdownMeta'
import { activeConcepts, CONCEPT_LABEL, referenceErrorKey } from '@/utils/manualPayment'
import type { ConceptSplit, ManualPaymentConcept } from '@/interfaces/payment'

const REFERENCE_MAX = 50

type References = Partial<Record<ManualPaymentConcept, string>>

interface Props {
  modelValue: References
  split?: ConceptSplit
  referenceLabel: string
  serverErrors?: Record<string, string[]>
}

const props = withDefaults(defineProps<Props>(), {
  split: undefined,
  serverErrors: () => ({}),
})

const emit = defineEmits<{ (e: 'update:modelValue', value: References): void }>()

const concepts = computed<ManualPaymentConcept[]>(() => activeConcepts(props.split))

const dismissed = ref<Set<ManualPaymentConcept>>(new Set())

// A new server response re-enables its messages.
watch(
  () => props.serverErrors,
  () => {
    dismissed.value = new Set()
  },
)

const fieldLabel = (concept: ManualPaymentConcept): string =>
  `${props.referenceLabel} · ${CONCEPT_LABEL[concept]} (${formatAmount(props.split?.[concept] ?? '0')}) *`

const fieldErrors = (concept: ManualPaymentConcept): string[] =>
  dismissed.value.has(concept) ? [] : (props.serverErrors[referenceErrorKey(concept)] ?? [])

const onInput = (concept: ManualPaymentConcept, value: string | null): void => {
  dismissed.value = new Set(dismissed.value).add(concept)
  emit('update:modelValue', { ...props.modelValue, [concept]: value ?? '' })
}

const normalized = (value: string | undefined): string => (value ?? '').trim().toLowerCase()

const requiredRule = (value: string): boolean | string =>
  (value ?? '').trim().length > 0 || 'Captura la referencia de este concepto.'
const maxRule = (value: string): boolean | string =>
  (value ?? '').trim().length <= REFERENCE_MAX || `Máximo ${REFERENCE_MAX} caracteres`
const distinctRule = (value: string): boolean | string =>
  normalized(value) === '' ||
  normalized(value) !== normalized(props.modelValue.beca) ||
  'La referencia de Apoyo debe ser distinta a la de Beca.'

const rulesFor = (concept: ManualPaymentConcept) =>
  concept === 'apoyo' && concepts.value.includes('beca')
    ? [requiredRule, maxRule, distinctRule]
    : [requiredRule, maxRule]
</script>
