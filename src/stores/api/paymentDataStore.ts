import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PaymentData, PaymentDataForm } from '@/interfaces/paymentData'
import type { PaymentDataResponse } from '@/interfaces/api'

// Duck-types the HTTP status off a rejected request rather than using
// axios.isAxiosError — the latter only recognizes real AxiosError instances
// (an `isAxiosError: true` marker set by axios itself), which a caller
// re-throwing `{ response: { status } }` (as impulsou-api's real 404 body
// does) would not satisfy.
function getStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status
  }
  return undefined
}

export const usePaymentDataStore = defineStore('paymentDataStore', () => {
  // Tracks, per user id, whether the most recent fetchPaymentData call found
  // an existing row. savePaymentData reads this to decide POST (create) vs
  // PUT (update-in-place) — per spec R2's create/update scenarios and design
  // D6. Kept in sync by savePaymentData itself too, so a caller does not
  // need to re-fetch between creating a row and saving it again.
  const existsByUser = ref<Map<number, boolean>>(new Map())

  // 404 means "not configured yet" — a normal, expected state per spec R1's
  // "user can exist with no payment-data row" scenario, not an error state.
  // Any other failure (network, 500, etc.) is rethrown for the caller to
  // handle/surface.
  const fetchPaymentData = async (userId: number): Promise<PaymentData | null> => {
    try {
      const res = await axios.get<PaymentDataResponse>(`api/admin/scholarship-payment-data/${userId}`)
      existsByUser.value.set(userId, true)
      return res.data.data
    } catch (error: unknown) {
      if (getStatus(error) === 404) {
        existsByUser.value.set(userId, false)
        return null
      }
      throw error
    }
  }

  const savePaymentData = async (userId: number, form: PaymentDataForm): Promise<PaymentData> => {
    const rowExists = existsByUser.value.get(userId) ?? false

    if (rowExists) {
      const res = await axios.put<PaymentDataResponse>(`api/admin/scholarship-payment-data/${userId}`, form)
      return res.data.data as PaymentData
    }

    const res = await axios.post<PaymentDataResponse>('api/admin/scholarship-payment-data', {
      user_id: userId,
      ...form,
    })
    existsByUser.value.set(userId, true)
    return res.data.data as PaymentData
  }

  return {
    fetchPaymentData,
    savePaymentData,
  }
})
