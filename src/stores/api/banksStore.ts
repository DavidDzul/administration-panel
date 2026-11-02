import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Bank, BankForm, BankDeleteResult } from '@/interfaces/bank'

interface BanksResponse {
  res: boolean
  banks: Bank[]
}

interface BankResponse {
  res: boolean
  bank: Bank
}

interface BankDeleteResponse {
  res: boolean
  deleted: boolean
  msg: string
  bank?: Bank
}

// Bank catalog (sdd/catalogo-bancos). Reads catch and return a boolean so the
// view can show a load error; writes deliberately do NOT catch so the UI
// decides how to surface a 422/403 (same split as rolesStore).
export const useBanksStore = defineStore('banksStore', () => {
  const banks = ref<Bank[]>([])

  const fetchBanks = async (): Promise<boolean> => {
    try {
      const res = await axios.get<BanksResponse>('api/admin/banks')
      banks.value = res.data.banks
      return true
    } catch (error: unknown) {
      console.error('Error al cargar bancos:', error)
      return false
    }
  }

  const replaceBank = (bank: Bank): void => {
    banks.value = banks.value.map((b) => (b.id === bank.id ? bank : b))
  }

  const createBank = async (form: BankForm): Promise<Bank> => {
    const res = await axios.post<BankResponse>('api/admin/banks', form)
    banks.value = [...banks.value, res.data.bank]
    return res.data.bank
  }

  const updateBank = async (id: number, form: BankForm): Promise<Bank> => {
    const res = await axios.put<BankResponse>(`api/admin/banks/${id}`, form)
    replaceBank(res.data.bank)
    return res.data.bank
  }

  const deleteBank = async (id: number): Promise<BankDeleteResult> => {
    const res = await axios.delete<BankDeleteResponse>(`api/admin/banks/${id}`)
    if (res.data.deleted) {
      banks.value = banks.value.filter((b) => b.id !== id)
    } else if (res.data.bank) {
      replaceBank(res.data.bank)
    }
    return { deleted: res.data.deleted, msg: res.data.msg }
  }

  return { banks, fetchBanks, createBank, updateBank, deleteBank }
})
