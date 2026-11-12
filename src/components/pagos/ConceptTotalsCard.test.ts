// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import type { ConceptTotals } from '@/interfaces/payment'

if (!('visualViewport' in window)) {
  Object.defineProperty(window, 'visualViewport', { value: null, writable: true })
}

import ConceptTotalsCard from '@/components/pagos/ConceptTotalsCard.vue'

const vuetify = createVuetify()

const zero = { beca: '0.00', apoyo: '0.00', total: '0.00' }

const totals: ConceptTotals = {
  channels: {
    bbva: { ready: { beca: '1000.00', apoyo: '0.00', total: '1000.00' }, paid: zero },
    manual_transfer: { ready: { beca: '1500.00', apoyo: '200.00', total: '1700.00' }, paid: zero },
    cheque: {
      ready: zero,
      paid: { beca: '800.00', apoyo: '200.00', total: '1000.00' },
    },
  },
  overall: {
    ready: { beca: '2500.00', apoyo: '200.00', total: '2700.00' },
    paid: { beca: '800.00', apoyo: '200.00', total: '1000.00' },
  },
}

const mountCard = (props: { totals?: ConceptTotals | null }) =>
  mount(ConceptTotalsCard, { props, global: { plugins: [vuetify] } })

const mountExpanded = async (props: { totals?: ConceptTotals | null }) => {
  const wrapper = mountCard(props)
  await wrapper.find('[data-testid="concept-totals"] .v-expansion-panel-title').trigger('click')
  return wrapper
}

describe('ConceptTotalsCard', () => {
  it('renders nothing without totals', () => {
    const wrapper = mountCard({ totals: null })
    expect(wrapper.find('[data-testid="concept-totals"]').exists()).toBe(false)
  })

  it('is a borderless expansion panel collapsed by default', () => {
    const wrapper = mountCard({ totals })
    const root = wrapper.find('[data-testid="concept-totals"]')

    expect(root.classes()).toContain('v-expansion-panels')
    expect(root.find('.v-card--variant-outlined').exists()).toBe(false)
    expect(root.text()).toContain('Totales combinados Beca / Apoyo')
    expect(wrapper.find('[data-testid="concept-totals-overall"]').exists()).toBe(false)
  })

  it('shows overall Beca and Apoyo for ready and paid, kept apart', async () => {
    const wrapper = await mountExpanded({ totals })
    const overall = wrapper.find('[data-testid="concept-totals-overall"]').text()

    expect(overall).toContain('Por pagar')
    expect(overall).toContain('$2,500.00')
    expect(overall).toContain('$200.00')
    expect(overall).toContain('$2,700.00')
    expect(overall).toContain('Pagado')
    expect(overall).toContain('$800.00')
    expect(overall).toContain('$1,000.00')
  })

  it('lists one breakdown row per channel with Beca, Apoyo and total', async () => {
    const wrapper = await mountExpanded({ totals })

    const bbva = wrapper.find('[data-testid="concept-totals-channel-bbva"]').text()
    expect(bbva).toContain('Transferencia BBVA')
    expect(bbva).toContain('$1,000.00')

    const manual = wrapper.find('[data-testid="concept-totals-channel-manual_transfer"]').text()
    expect(manual).toContain('Otros bancos')
    expect(manual).toContain('$1,500.00')
    expect(manual).toContain('$200.00')
    expect(manual).toContain('$1,700.00')

    const cheque = wrapper.find('[data-testid="concept-totals-channel-cheque"]').text()
    expect(cheque).toContain('Cheques')
    expect(cheque).toContain('$800.00')
  })
})
