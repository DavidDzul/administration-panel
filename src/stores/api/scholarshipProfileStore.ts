import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import type { ScholarshipProfileConfig, ScholarshipProfileConfigForm } from '@/interfaces/scholarshipProfile'
import type { ScholarshipProfileConfigResponse } from '@/interfaces/api'

// Duck-types the HTTP status off a rejected request, same as
// paymentDataStore.ts — axios.isAxiosError only recognizes real AxiosError
// instances, which a caller re-throwing `{ response: { status } }` (as
// impulsou-api's real 404 body does) would not satisfy.
function getStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status
  }
  return undefined
}

// Design D5 (sdd/scholarship-profile-config-to-admin): no dedicated
// admin-only read endpoint exists — this reuses the EXISTING ungated
// `scholarship-profiles/{userId}` route (shared with psicol-panel) and
// writes ONLY via the gated `/config` route (design D2/D9).
export const useScholarshipProfileStore = defineStore('scholarshipProfileStore', () => {
  // 404 means "no scholarship profile yet" — a normal, expected state
  // (same pattern as paymentDataStore.fetchPaymentData), not an error.
  // Any other failure (network, 500, etc.) is rethrown for the caller to
  // handle/surface.
  const fetchProfileConfig = async (userId: number): Promise<ScholarshipProfileConfig | null> => {
    try {
      const res = await axios.get<ScholarshipProfileConfigResponse>(`api/admin/scholarship-profiles/${userId}`)
      return res.data.data
    } catch (error: unknown) {
      if (getStatus(error) === 404) {
        return null
      }
      throw error
    }
  }

  // No POST variant needed: PUT /config is create-or-update (sdd/perfil-beca-montos-admin).
  // If the becario has no scholarship profile yet, the backend creates it and
  // stamps `config_set_at`; if one exists, it updates the 4 config fields and
  // refreshes `config_set_at`. Always responds 200.
  const saveProfileConfig = async (
    userId: number,
    form: ScholarshipProfileConfigForm,
  ): Promise<ScholarshipProfileConfig> => {
    const res = await axios.put<ScholarshipProfileConfigResponse>(
      `api/admin/scholarship-profiles/${userId}/config`,
      form,
    )
    return res.data.data as ScholarshipProfileConfig
  }

  return {
    fetchProfileConfig,
    saveProfileConfig,
  }
})
