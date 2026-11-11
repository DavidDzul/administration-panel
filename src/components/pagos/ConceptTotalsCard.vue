<template>
  <v-card v-if="totals" variant="outlined" class="mb-4" data-testid="concept-totals">
    <v-card-title class="text-subtitle-1 font-weight-medium">Totales combinados Beca / Apoyo</v-card-title>
    <v-card-text>
      <v-row data-testid="concept-totals-overall">
        <v-col v-for="basis in BASES" :key="basis.key" cols="12" sm="6">
          <v-card variant="tonal" :color="basis.color" class="concept-totals-basis">
            <v-card-text>
              <div class="text-caption text-medium-emphasis">{{ basis.label }}</div>
              <div class="text-h5 font-weight-medium">{{ money(totals.overall[basis.key].total) }}</div>
              <div class="text-body-2">
                Cuenta Beca {{ money(totals.overall[basis.key].beca) }} · Cuenta Apoyo
                {{ money(totals.overall[basis.key].apoyo) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-table density="compact" class="mt-2">
        <thead>
          <tr>
            <th>Canal</th>
            <th v-for="basis in BASES" :key="basis.key" colspan="1">{{ basis.label }} (Beca · Apoyo · Total)</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="channel in CHANNELS"
            :key="channel.key"
            :data-testid="`concept-totals-channel-${channel.key}`"
          >
            <td>{{ channel.label }}</td>
            <td v-for="basis in BASES" :key="basis.key">
              {{ money(totals.channels[channel.key][basis.key].beca) }} ·
              {{ money(totals.channels[channel.key][basis.key].apoyo) }} ·
              {{ money(totals.channels[channel.key][basis.key].total) }}
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
// Read-only combined Beca/Apoyo totals across BBVA, other-bank transfers and
// cheques (sdd/bank-file-split-other-banks-cheques PR6). Everything is
// computed by the API; "por pagar" and "pagado" are different bases and are
// shown side by side, never summed.
import { formatAmount } from '@/utils/paymentBreakdownMeta'
import type { ConceptTotals, ConceptTotalsChannel } from '@/interfaces/payment'

interface Props {
  totals?: ConceptTotals | null
}

withDefaults(defineProps<Props>(), { totals: null })

const money = (amount: string): string => formatAmount(amount)

const BASES = [
  { key: 'ready', label: 'Por pagar', color: 'primary' },
  { key: 'paid', label: 'Pagado', color: 'success' },
] as const

const CHANNELS: ReadonlyArray<{ key: ConceptTotalsChannel; label: string }> = [
  { key: 'bbva', label: 'Transferencia BBVA' },
  { key: 'manual_transfer', label: 'Otros bancos' },
  { key: 'cheque', label: 'Cheques' },
]
</script>

<style scoped>
.concept-totals-basis {
  height: 100%;
}
</style>
