import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AlertConfig } from '@/interfaces/alert'

export const useAlertStore = defineStore('alertStore', () => {
  const show = ref<boolean>(false)
  const config = ref<AlertConfig>({ title: '', status: 'success' })

  const showAlert = (conf: AlertConfig): void => {
    if (!show.value) {
      show.value = false
    }
    config.value = { ...conf }
    show.value = true
  }

  const $reset = (): void => {
    show.value = false
    config.value = { title: '', status: 'success' }
  }

  return { show, config, showAlert, $reset }
})
