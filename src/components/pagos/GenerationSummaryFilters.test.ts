// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VSelect } from 'vuetify/components'
import GenerationSummaryFilters from '@/components/pagos/GenerationSummaryFilters.vue'
import type { GenerationOption } from '@/composables/usePaymentsByGenerationPage'
import type { SelectOption } from '@/constants'

const vuetify = createVuetify()

const buildOptions = (): GenerationOption[] => [
  { title: 'Generación A', value: 1 },
  { title: 'Generación B', value: 2 },
]

const buildCampusOptions = (): SelectOption[] => [
  { value: 'MERIDA', text: 'Mérida' },
  { value: 'VALLADOLID', text: 'Valladolid' },
]

interface MountProps {
  campus: string | null
  generationId: number | null
  periodYear: number | null
  periodMonth: number | null
  campusOptions?: SelectOption[]
  generationOptions?: GenerationOption[]
}

const mountFilters = (props: Partial<MountProps> = {}) =>
  mount(GenerationSummaryFilters, {
    global: { plugins: [vuetify] },
    props: {
      campus: null,
      generationId: null,
      periodYear: null,
      periodMonth: null,
      campusOptions: buildCampusOptions(),
      generationOptions: buildOptions(),
      ...props,
    },
  })

const selectByLabel = (wrapper: ReturnType<typeof mountFilters>, label: string) =>
  wrapper.findAllComponents(VSelect).find((s) => s.props('label') === label)

describe('GenerationSummaryFilters', () => {
  it('renders the sede options passed in via props', () => {
    const wrapper = mountFilters()

    expect(selectByLabel(wrapper, 'Sede')?.props('items')).toEqual(buildCampusOptions())
  })

  it('renders the generation options passed in via props', () => {
    const wrapper = mountFilters()

    expect(selectByLabel(wrapper, 'Generación')?.props('items')).toEqual(buildOptions())
  })

  it('emits update:campus when the sede select changes', async () => {
    const wrapper = mountFilters()

    await selectByLabel(wrapper, 'Sede')?.vm.$emit('update:modelValue', 'VALLADOLID')

    expect(wrapper.emitted('update:campus')).toEqual([['VALLADOLID']])
  })

  it('emits update:generationId when the generación select changes', async () => {
    const wrapper = mountFilters({ campus: 'MERIDA' })

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

  it('reflects the current campus/generationId/periodYear/periodMonth prop values', () => {
    const wrapper = mountFilters({ campus: 'VALLADOLID', generationId: 2, periodYear: 2026, periodMonth: 9 })

    expect(selectByLabel(wrapper, 'Sede')?.props('modelValue')).toBe('VALLADOLID')
    expect(selectByLabel(wrapper, 'Generación')?.props('modelValue')).toBe(2)
    expect(selectByLabel(wrapper, 'Año')?.props('modelValue')).toBe(2026)
    expect(selectByLabel(wrapper, 'Mes')?.props('modelValue')).toBe(9)
  })

  it('disables the generación select until a sede is chosen', () => {
    const wrapperNoCampus = mountFilters({ campus: null })
    expect(selectByLabel(wrapperNoCampus, 'Generación')?.props('disabled')).toBe(true)

    const wrapperWithCampus = mountFilters({ campus: 'MERIDA' })
    expect(selectByLabel(wrapperWithCampus, 'Generación')?.props('disabled')).toBe(false)
  })
})
