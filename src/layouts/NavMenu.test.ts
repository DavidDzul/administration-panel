// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import { ref } from 'vue'

const mockPermissions = ref<string[]>([])
vi.mock('@/stores/api/authStore', () => ({
  useAuthStore: () => ({ permissions: mockPermissions }),
}))

// Static import after the mock — Vitest hoists `vi.mock` above imports, so
// NavMenu resolves against the mocked authStore.
import NavMenu from '@/layouts/NavMenu.vue'

const vuetify = createVuetify()
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/becarios', component: { template: '<div />' } },
  ],
})

const mountNav = () => mount(NavMenu, { global: { plugins: [vuetify, router] } })

describe('NavMenu — "Usuarios" group gating on ADM_READ_USERS', () => {
  beforeEach(() => {
    mockPermissions.value = []
  })

  it('shows "Usuarios" > "Becarios y egresados" when the user holds ADM_READ_USERS', async () => {
    mockPermissions.value = ['ADM_READ_USERS']
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Usuarios')
    expect(wrapper.text()).toContain('Becarios y egresados')
  })

  it('hides the entire "Usuarios" group when the user lacks ADM_READ_USERS', async () => {
    mockPermissions.value = []
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Usuarios')
    expect(wrapper.text()).not.toContain('Becarios y egresados')
  })

  it('always shows "Inicio" regardless of permissions', async () => {
    mockPermissions.value = []
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Inicio')
  })
})
