import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import type { ScholarshipSetting, ScholarshipSettingForm } from '@/interfaces/scholarshipSetting'
import type { ScholarshipSettingResponse } from '@/interfaces/api'

// Design D8 (sdd/scholarship-telmex-iu-split): GET `admin/scholarship-settings`
// is ungated shared reference data (used both by ScholarshipSettingsView and
// PaymentDataDialog's informational hint); PUT is gated server-side behind
// `ADM_MANAGE_SCHOLARSHIP_SETTINGS` (route middleware, mirrors
// scholarshipProfileStore's GET/PUT gating split). Unlike
// scholarshipProfileStore.fetchProfileConfig, there is no 404 "not
// configured" case here — the single settings row always exists
// (`ScholarshipSetting::current()`'s `firstOrCreate`), so errors are always
// real errors and are simply rethrown.
export const useScholarshipSettingsStore = defineStore('scholarshipSettingsStore', () => {
  const fetchSetting = async (): Promise<ScholarshipSetting> => {
    const res = await axios.get<ScholarshipSettingResponse>('api/admin/scholarship-settings')
    return res.data.data
  }

  const saveSetting = async (form: ScholarshipSettingForm): Promise<ScholarshipSetting> => {
    const res = await axios.put<ScholarshipSettingResponse>('api/admin/scholarship-settings', form)
    return res.data.data
  }

  return {
    fetchSetting,
    saveSetting,
  }
})
