import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAlertStore } from '@/stores/alert'
import type { UserProfile } from '@/interfaces/user'
import type { LoginResponse } from '@/interfaces/api'

export const useAuthStore = defineStore('authStore', () => {
  const router = useRouter()
  const { showAlert } = useAlertStore()

  const token = ref<string>('')
  const loggedUser = ref<boolean>(false)
  const userProfile = ref<UserProfile>()

  const login = async (email: string, password: string): Promise<void> => {
    const credentials = { email, password }
    try {
      // NOTE: this sanctum/csrf-cookie precall is inert under the bearer-token
      // auth flow used by this panel — it targets Sanctum's stateful/cookie
      // session guard, which `api/administration/*` does not use (auth is via
      // `Authorization: Bearer` headers, see below). Kept only for parity with
      // psicol-panel's auth pattern; do not mistake it for real session auth.
      await axios.get('sanctum/csrf-cookie')
      const res = await axios.post<LoginResponse>('api/administration/login', credentials, {
        headers: { accept: 'application/json' },
      })

      token.value = res.data.token
      localStorage.setItem('token', token.value)

      axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`

      await router.push({ path: '/' })
    } catch (error: unknown) {
      console.error('Error en login:', error)
      showAlert({
        title: 'Error al iniciar sesión, verifica tu usuario y/o contraseña.',
        status: 'error',
      })
    }
  }

  const logout = async (): Promise<void> => {
    await axios
      .post('api/administration/logout')
      .then(async () => {
        loggedUser.value = false
        userProfile.value = undefined
        token.value = ''
        localStorage.removeItem('token')
        window.location.href = '/auth/login'
      })
      .catch(() => {
        showAlert({
          title: 'Error al cerrar sesión.',
          status: 'error',
        })
      })
  }

  const getProfile = async (authToken: string): Promise<void> => {
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
    // Inert precall — see login()'s comment above for rationale.
    await axios.get('sanctum/csrf-cookie')
    await axios
      .get<UserProfile>('api/administration/administration')
      .then((res) => {
        loggedUser.value = true
        userProfile.value = res.data
        token.value = authToken
      })
      .catch((error: unknown) => {
        console.error('Error al obtener el perfil:', error)
      })
  }

  const userInitials = computed<string>(
    () =>
      `${userProfile?.value?.first_name.charAt(0) || ''}${userProfile?.value?.last_name.charAt(0) || ''}`,
  )

  const fullName = computed<string>(
    () => `${userProfile?.value?.first_name || ''} ${userProfile?.value?.last_name || ''}`,
  )

  return {
    login,
    logout,
    getProfile,
    token,
    fullName,
    loggedUser,
    userProfile,
    userInitials,
  }
})
