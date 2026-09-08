import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/api/authStore'
import { useAppStore } from '@/stores/app'
import { ref } from 'vue'

export const useLoginPageStore = defineStore('loginPage', () => {
  const { setLoading } = useAppStore()
  const { login } = useAuthStore()

  const loading = ref<boolean>(false)
  const password = ref<string>('')
  const email = ref<string>('')

  const onLogin = async (): Promise<void> => {
    loading.value = true
    try {
      if (email.value && password.value) {
        await login(email.value, password.value)
      }
    } catch (e) {
      console.error('Error en onLogin:', e)
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    password,
    email,
    onLogin,
  }
})
