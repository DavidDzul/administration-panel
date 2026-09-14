import { storeToRefs } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/api/authStore'

// Reloads the app once if a lazy-loaded chunk fails (stale deployed build).
const catchReload = <T>(importPromise: Promise<T>): Promise<T> => {
  return importPromise.catch((error: unknown) => {
    if (error instanceof Error) {
      const isChunkLoadError =
        /Failed to fetch dynamically imported module|chunk load failed/i.test(error.message) ||
        error.name === 'ChunkLoadError'

      if (isChunkLoadError) {
        console.warn('Versión antigua detectada. Recargando...')

        setTimeout(() => {
          window.location.reload()
        }, 100)

        return new Promise<T>(() => {})
      }
    }

    throw error
  })
}

const routes = [
  {
    path: '/auth',
    name: 'AuthLayout',
    component: () => catchReload(import('@/layouts/AuthLayout.vue')),
    redirect: 'auth/login',
    beforeEnter: async () => {
      const authStore = useAuthStore()
      const { getProfile } = authStore
      const { loggedUser } = storeToRefs(authStore)

      const token = localStorage.getItem('token')

      if (!token) return true

      if (loggedUser.value) {
        return '/'
      }

      await getProfile(token)
      return true
    },
    children: [
      {
        path: 'login',
        name: 'Login',
        component: () => catchReload(import('@/views/auth/LoginView.vue')),
      },
    ],
  },
  {
    path: '/',
    name: 'home',
    component: () => catchReload(import('@/layouts/AdminLayout.vue')),
    meta: { requiresAuth: true },
    children: [
      {
        path: '/',
        name: 'Inicio',
        component: () => catchReload(import('@/views/HomeView.vue')),
      },
      {
        path: '/becarios',
        name: 'PersonsView',
        component: () => catchReload(import('@/views/users/PersonsView.vue')),
      },
      {
        path: '/becarios/:id',
        name: 'PersonDetailsView',
        component: () => catchReload(import('@/views/users/PersonDetailsView.vue')),
      },
      {
        path: '/control/roles',
        name: 'RolesView',
        component: () => catchReload(import('@/views/roles/RolesView.vue')),
      },
      {
        path: '/control/roles/:id',
        name: 'RoleDetailView',
        component: () => catchReload(import('@/views/roles/RoleDetailView.vue')),
      },
      {
        path: '/control/accesos',
        name: 'AccesosView',
        component: () => catchReload(import('@/views/accesos/AccesosView.vue')),
      },
      {
        path: '/control/accesos/:id',
        name: 'AccesoDetailView',
        component: () => catchReload(import('@/views/accesos/AccesoDetailView.vue')),
      },
      {
        path: '/pagos',
        name: 'PaymentsView',
        component: () => catchReload(import('@/views/pagos/PaymentsView.vue')),
      },
      // Note: `/pagos/:refrendId` (document view) is PR6, not this batch.
    ],
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => catchReload(import('@/views/NotFound.vue')),
  },
  {
    path: '/:catchAll(.*)',
    redirect: '/404',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Guard global para manejar autenticación
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const { getProfile } = authStore
  const { loggedUser } = storeToRefs(authStore)

  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth) {
    if (token && loggedUser.value) {
      return true
    }

    if (token && !loggedUser.value) {
      await getProfile(token)

      if (loggedUser.value) {
        return true
      }

      return {
        path: '/auth/login',
        query: { redirect: to.fullPath },
      }
    }

    return {
      path: '/auth/login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.guest && token && loggedUser.value) {
    return '/'
  }

  return true
})

export default router
