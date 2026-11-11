// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VForm, VTextField } from 'vuetify/components'
import { h, ref } from 'vue'
import type { ConceptSplit, ManualPaymentConcept } from '@/interfaces/payment'

if (!('visualViewport' in window)) {
  Object.defineProperty(window, 'visualViewport', { value: null, writable: true })
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

import ConceptReferenceFields from '@/components/pagos/ConceptReferenceFields.vue'
import { activeConcepts } from '@/utils/manualPayment'

const vuetify = createVuetify()

const mountFields = (
  split: ConceptSplit | undefined,
  references: Partial<Record<ManualPaymentConcept, string>> = {},
  serverErrors: Record<string, string[]> = {},
) => {
  const model = ref({ ...references })
  const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)
  const wrapper = mount(
    {
      render: () =>
        h(VForm, { ref: formRef }, () =>
          h(ConceptReferenceFields, {
            modelValue: model.value,
            'onUpdate:modelValue': (value: Partial<Record<ManualPaymentConcept, string>>) => {
              model.value = value
            },
            split,
            referenceLabel: 'Número de cheque',
            serverErrors,
          }),
        ),
    },
    { global: { plugins: [vuetify] } },
  )
  return { wrapper, model, formRef }
}

const fields = (wrapper: ReturnType<typeof mountFields>['wrapper']) => wrapper.findAllComponents(VTextField)

describe('activeConcepts', () => {
  it('returns Beca then Apoyo for concepts with amount > 0', () => {
    expect(activeConcepts({ beca: '800.00', apoyo: '200.00' })).toEqual(['beca', 'apoyo'])
  })

  it('omits a zero concept', () => {
    expect(activeConcepts({ beca: '1000.00', apoyo: '0.00' })).toEqual(['beca'])
    expect(activeConcepts({ beca: '0.00', apoyo: '1000.00' })).toEqual(['apoyo'])
  })

  it('returns [] without a split', () => {
    expect(activeConcepts(undefined)).toEqual([])
  })
})

describe('ConceptReferenceFields', () => {
  it('renders one field per concept with amount, showing the amount in the label', () => {
    const { wrapper } = mountFields({ beca: '800.00', apoyo: '200.00' })
    const labels = fields(wrapper).map((f) => f.props('label') as string)
    expect(labels).toHaveLength(2)
    expect(labels[0]).toContain('Número de cheque')
    expect(labels[0]).toContain('Beca')
    expect(labels[0]).toContain('$800.00')
    expect(labels[1]).toContain('Apoyo')
    expect(labels[1]).toContain('$200.00')
  })

  it('renders no field for a zero concept', () => {
    const { wrapper } = mountFields({ beca: '1000.00', apoyo: '0.00' })
    const labels = fields(wrapper).map((f) => f.props('label') as string)
    expect(labels).toHaveLength(1)
    expect(labels[0]).toContain('Beca')
  })

  it('emits the new references keyed by concept when typing', async () => {
    const { wrapper, model } = mountFields({ beca: '800.00', apoyo: '200.00' })
    await fields(wrapper)[0].setValue('CH-1')
    await fields(wrapper)[1].setValue('CH-2')
    expect(model.value).toEqual({ beca: 'CH-1', apoyo: 'CH-2' })
  })

  it('is invalid when an active concept reference is blank', async () => {
    const { formRef } = mountFields({ beca: '800.00', apoyo: '200.00' }, { beca: 'CH-1', apoyo: '  ' })
    await flushPromises()
    expect((await formRef.value?.validate())?.valid).toBe(false)
  })

  it('is invalid when beca and apoyo are equal ignoring case and spaces', async () => {
    const { formRef } = mountFields({ beca: '800.00', apoyo: '200.00' }, { beca: 'AB-1', apoyo: ' ab-1 ' })
    await flushPromises()
    expect((await formRef.value?.validate())?.valid).toBe(false)
  })

  it('is valid with two distinct references', async () => {
    const { formRef } = mountFields({ beca: '800.00', apoyo: '200.00' }, { beca: 'AB-1', apoyo: 'AB-2' })
    await flushPromises()
    expect((await formRef.value?.validate())?.valid).toBe(true)
  })

  it('does not require the zero concept', async () => {
    const { formRef } = mountFields({ beca: '1000.00', apoyo: '0.00' }, { beca: 'AB-1' })
    await flushPromises()
    expect((await formRef.value?.validate())?.valid).toBe(true)
  })

  it('rejects a reference longer than 50 chars', async () => {
    const { formRef } = mountFields({ beca: '1000.00', apoyo: '0.00' }, { beca: 'x'.repeat(51) })
    await flushPromises()
    expect((await formRef.value?.validate())?.valid).toBe(false)
  })

  it('shows server errors under the matching concept field only', () => {
    const { wrapper } = mountFields(
      { beca: '800.00', apoyo: '200.00' },
      { beca: 'AB-1', apoyo: 'AB-2' },
      { 'references.apoyo': ['Esa referencia ya fue registrada.'] },
    )
    const [beca, apoyo] = fields(wrapper)
    expect(beca.props('errorMessages')).toEqual([])
    expect(apoyo.props('errorMessages')).toEqual(['Esa referencia ya fue registrada.'])
  })
})
