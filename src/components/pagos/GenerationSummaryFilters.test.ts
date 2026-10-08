// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VSelect } from 'vuetify/components'
import GenerationSummaryFilters from '@/components/pagos/GenerationSummaryFilters.vue'
import type { GenerationOption } from '@/composables/usePaymentsByGenerationPage'

const vuetify = createVuetify()

const buildOptions = (): GenerationOption[] => [
  { title: 'Generación A — MERIDA', value: 1 },
  { title: 'Generación B — VALLADOLID', value: 2 },
]

interface MountProps {
  generationId: number | null
  periodYear: number | null
  periodMonth: number | null
  generationOptions?: GenerationOption[]
}

const mountFilters = (props: Partial<MountProps> = {}) =>
  mount(GenerationSummaryFilters, {
    global: { plugins: [vuetify] },
    props: {
      generationId: null,
      periodYear: null,
      periodMonth: null,
      generationOptions: buildOptions(),
      ...props,
    },
  })

const selectByLabel = (wrapper: ReturnType<typeof mountFilters>, label: string) =>
  wrapper.findAllComponents(VSelect).find((s) => s.props('label') === label)

describe('GenerationSummaryFilters', () => {
  it('renders the generation options passed in via props', () => {
    const wrapper = mountFilters()

    expect(selectByLabel(wrapper, 'Generación')?.props('items')).toEqual(buildOptions())
  })

  it('emits update:generationId when the generación select changes', async () => {
    const wrapper = mountFilters()

    await selectByLabel(wrapper, 'Generación')?.vm.$emit('update:modelValue', 2)

    expect(wrapper.emitted('update:generationId')).toEqual([[2]])
  })

  it('emits update:periodYear when the año select changes', async () => {
    const wrapper = mountFilters()

    await selectByLabel(wrapper, 'Año')?.vm.$emit('update:modelValue', 2026)

    expect(wrapper.emitted('update:periodYear')).toEqual([[2026]])
  })

  it('emits update:periodMonth when the mes select changes', async () => {
    const wrapper = mountFilters()

    await selectByLabel(wrapper, 'Mes')?.vm.$emit('update:modelValue', 9)

    expect(wrapper.emitted('update:periodMonth')).toEqual([[9]])
  })

  it('reflects the current generationId/periodYear/periodMonth prop values', () => {
    const wrapper = mountFilters({ generationId: 2, periodYear: 2026, periodMonth: 9 })

    expect(selectByLabel(wrapper, 'Generación')?.props('modelValue')).toBe(2)
    expect(selectByLabel(wrapper, 'Año')?.props('modelValue')).toBe(2026)
    expect(selectByLabel(wrapper, 'Mes')?.props('modelValue')).toBe(9)
  })
})
