import axios from '@/axiosConfig'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAlertStore } from '@/stores/alert'
import type { UserProfile, UserProfileForm } from '@/interfaces/user'
import type { LoginResponse, PermissionsListResponse, UpdateProfileResponse } from '@/interfaces/api'
import { campusArray, PERMISSIONS } from '@/constants'
import type { SelectOption } from '@/constants'

export const useAuthStore = defineStore('authStore', () => {
  const router = useRouter()
  const { showAlert } = useAlertStore()

  const token = ref<string>('')
  const loggedUser = ref<boolean>(false)
  const userProfile = ref<UserProfile>()
  const permissions = ref<string[]>([])

  const login = async (email: string, password: string): Promise<void> => {
    const credentials = { email, password }
    try {
      // NOTE: this sanctum/csrf-cookie precall is inert under the bearer-token
      // auth flow used by this panel (auth is via `Authorization: Bearer`
      // headers, see below). Kept only for parity with psicol-panel's auth
      // pattern; do not mistake it for real session auth.
      await axios.get('sanctum/csrf-cookie')
      const res = await axios.post<LoginResponse>('api/admin/login', credentials, {
        headers: { accept: 'application/json' },
      })

      token.value = res.data.token
      localStorage.setItem('token', token.value)

      axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`

      await getPermissions(token.value)
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
      .post('api/admin/logout')
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
      .get<UserProfile>('api/admin/admin')
      .then(async (res) => {
        loggedUser.value = true
        userProfile.value = res.data
        token.value = authToken
        // On a hard reload the router guard only calls getProfile — without
        // this call here, nav would render unpermissioned until the next login.
        await getPermissions(authToken)
      })
      .catch((error: unknown) => {
        console.error('Error al obtener el perfil:', error)
      })
  }

  const getPermissions = async (authToken: string): Promise<string[]> => {
    try {
      const response = await axios.get<PermissionsListResponse>('api/admin/permissions', {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      permissions.value = response.data.permissions
      return permissions.value
    } catch (error: unknown) {
      console.error('Error fetching user permissions:', error)
      permissions.value = []
      return []
    }
  }

  const updateProfile = async (form: UserProfileForm): Promise<void> => {
    try {
      const res = await axios.post<UpdateProfileResponse>('api/admin/updateProfile', form, {
        headers: { accept: 'application/json' },
      })
      showAlert({
        title: 'Información guardada exitosamente.',
        status: 'success',
      })
      userProfile.value = {
        ...(userProfile.value ?? ({} as UserProfile)),
        first_name: res.data.user.first_name,
        last_name: res.data.user.last_name,
        email: res.data.user.email,
        phone: res.data.user.phone,
      }
    } catch (error: unknown) {
      console.error(error)
      showAlert({
        title: 'Error al guardar la información, intente nuevamente.',
        status: 'error',
      })
      throw error
    }
  }

  const userInitials = computed<string>(
    () =>
      `${userProfile?.value?.first_name.charAt(0) || ''}${userProfile?.value?.last_name.charAt(0) || ''}`,
  )

  const fullName = computed<string>(
    () => `${userProfile?.value?.first_name || ''} ${userProfile?.value?.last_name || ''}`,
  )

  // D5: mirrors D1's backend fix on the client — ROOT and ROOT_ADMINISTRATION
  // both see every campus (psicol-panel allowlists ROOT/ROOT_JOB instead).
  // Without this, the sede filter would render empty for admin accounts.
  const filteredCampus = computed<SelectOption[]>(() => {
    if (userProfile.value?.roles.some((r) => r.name === 'ROOT' || r.name === 'ROOT_ADMINISTRATION')) {
      return campusArray
    }
    return campusArray.filter((c) => c.value === userProfile.value?.campus)
  })

  // Single permission gates the nav entry, the route, and both backing
  // fetches (users + graduates) — see constants.ts PERMISSIONS module.
  const readUsers = computed<boolean>(() => permissions.value.includes(PERMISSIONS.READ_USERS))

  // Read/write split for scholarship_payment_data — mirrors readUsers
  // exactly (design D5, sdd/becarios-payment-config).
  const readPaymentData = computed<boolean>(() => permissions.value.includes(PERMISSIONS.READ_PAYMENT_DATA))
  const editPaymentData = computed<boolean>(() => permissions.value.includes(PERMISSIONS.EDIT_PAYMENT_DATA))

  return {
    login,
    logout,
    getProfile,
    getPermissions,
    updateProfile,
    token,
    fullName,
    loggedUser,
    userProfile,
    userInitials,
    permissions,
    filteredCampus,
    readUsers,
    readPaymentData,
    editPaymentData,
  }
})
