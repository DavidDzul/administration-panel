import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  TelmexCoverage,
  EligibleTelmexBecario,
  TelmexCoverageStatement,
  TelmexCoveragePayment,
  TelmexCoverageStatus,
  ActivateTelmexCoveragePayload,
  EndTelmexCoveragePayload,
  CancelTelmexCoveragePayload,
  RegisterTelmexCoveragePaymentPayload,
  VoidTelmexCoveragePaymentPayload,
} from '@/interfaces/telmexCoverage'
import type {
  TelmexCoveragesResponse,
  TelmexCoverageResponse,
  EligibleTelmexBecariosResponse,
  TelmexCoverageStatementResponse,
  TelmexCoveragePaymentResponse,
} from '@/interfaces/api'

// Becas Telmex (sdd/telmex-cobertura-iu, PR4) — calls the
// `api/admin/telmex-coverages` endpoints (design #1920's API table). The
// backend (PR3a/PR3b) has NOT landed yet — every endpoint path here is coded
// against the design contract, mirroring rolesStore's isolation precedent.
//
// ASSUMPTION flagged for PR3b: the design's API table has no dedicated
// "reactivate" entry (only decisions-2 #1921 dec3 allows it). `reactivateCoverage`
// below assumes `POST {coverage}/reactivate` gated by the same
// ADM_MANAGE_TELMEX_COVERAGE permission as activate/end/cancel, mirroring
// those three endpoints' shape exactly. PR3b must either match this path or
// this store's method must be updated to match PR3b's real one.
//
// Read methods catch-and-return-boolean/null (mirrors rolesStore.fetchRoles/
// fetchRole). Write methods deliberately do NOT catch — errors propagate to
// the caller (mirrors rolesStore.createRole/syncRolePermissions) so the
// dialog layer decides how to surface a 403/422.
export const useTelmexCoverageStore = defineStore('telmexCoverageStore', () => {
  const allCoverages = ref<Map<number, TelmexCoverage>>(new Map())
  const eligibleBecarios = ref<EligibleTelmexBecario[]>([])

  const fetchCoverages = async (filters?: { status?: TelmexCoverageStatus; search?: string }): Promise<boolean> => {
    try {
      const res = await axios.get<TelmexCoveragesResponse>('api/admin/telmex-coverages', {
        params: { ...filters },
      })
      allCoverages.value = new Map(res.data.data.map((c) => [c.id, c]))
      return true
    } catch (error: unknown) {
      console.error('Error al cargar las coberturas Telmex:', error)
      return false
    }
  }

  const fetchEligibleBecarios = async (): Promise<boolean> => {
    try {
      const res = await axios.get<EligibleTelmexBecariosResponse>('api/admin/telmex-coverages/eligible')
      eligibleBecarios.value = res.data.data
      return true
    } catch (error: unknown) {
      console.error('Error al cargar los becarios elegibles:', error)
      return false
    }
  }

  const fetchCoverageStatement = async (id: number): Promise<TelmexCoverageStatement | null> => {
    try {
      const res = await axios.get<TelmexCoverageStatementResponse>(`api/admin/telmex-coverages/${id}`)
      return res.data.data
    } catch (error: unknown) {
      console.error('Error al cargar el estado de cuenta de la cobertura:', error)
      return null
    }
  }

  const activateCoverage = async (payload: ActivateTelmexCoveragePayload): Promise<TelmexCoverage> => {
    const res = await axios.post<TelmexCoverageResponse>('api/admin/telmex-coverages', payload)
    allCoverages.value.set(res.data.data.id, res.data.data)
    return res.data.data
  }

  const endCoverage = async (id: number, payload: EndTelmexCoveragePayload): Promise<TelmexCoverage> => {
    const res = await axios.post<TelmexCoverageResponse>(`api/admin/telmex-coverages/${id}/end`, payload)
    allCoverages.value.set(res.data.data.id, res.data.data)
    return res.data.data
  }

  const cancelCoverage = async (id: number, payload: CancelTelmexCoveragePayload): Promise<TelmexCoverage> => {
    const res = await axios.post<TelmexCoverageResponse>(`api/admin/telmex-coverages/${id}/cancel`, payload)
    allCoverages.value.set(res.data.data.id, res.data.data)
    return res.data.data
  }

  const reactivateCoverage = async (id: number): Promise<TelmexCoverage> => {
    const res = await axios.post<TelmexCoverageResponse>(`api/admin/telmex-coverages/${id}/reactivate`)
    allCoverages.value.set(res.data.data.id, res.data.data)
    return res.data.data
  }

  const registerPayment = async (
    id: number,
    payload: RegisterTelmexCoveragePaymentPayload,
  ): Promise<TelmexCoveragePayment> => {
    const res = await axios.post<TelmexCoveragePaymentResponse>(`api/admin/telmex-coverages/${id}/payments`, payload)
    return res.data.data
  }

  const voidPayment = async (
    id: number,
    paymentId: number,
    payload: VoidTelmexCoveragePaymentPayload,
  ): Promise<TelmexCoveragePayment> => {
    const res = await axios.patch<TelmexCoveragePaymentResponse>(
      `api/admin/telmex-coverages/${id}/payments/${paymentId}/void`,
      payload,
    )
    return res.data.data
  }

  return {
    allCoverages,
    eligibleBecarios,
    fetchCoverages,
    fetchEligibleBecarios,
    fetchCoverageStatement,
    activateCoverage,
    endCoverage,
    cancelCoverage,
    reactivateCoverage,
    registerPayment,
    voidPayment,
  }
})
