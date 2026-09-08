import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('appStore', () => {
  const loading = ref<boolean>(false)

  const setLoading = (status: boolean): void => {
    loading.value = status
  }

  const $reset = (): void => {
    loading.value = false
  }

  return {
    loading,
    setLoading,
    $reset,
  }
})
