import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Generation } from '@/interfaces/generation'
import type { GenerationsResponse } from '@/interfaces/api'

export const useGenerationStore = defineStore('generationStore', () => {
  const resGenerations = ref<Map<number, Generation>>(new Map())

  // Read-only — no create/update, per spec's out-of-scope boundary for this
  // slice. Mirrors psicol-panel's generationStore.fetchGenerations.
  const fetchGenerations = async (): Promise<GenerationsResponse | undefined> => {
    try {
      const res = await axios.get<GenerationsResponse>('api/admin/generations', {
        headers: { accept: 'application/json' },
      })
      resGenerations.value = new Map(res.data.generations.map((g) => [g.id, g]))
      return res.data
    } catch (error: unknown) {
      console.error('Error al cargar generaciones:', error)
      return undefined
    }
  }

  return {
    resGenerations,
    fetchGenerations,
  }
})
