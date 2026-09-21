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
    { path: '/control/roles', component: { template: '<div />' } },
    { path: '/control/accesos', component: { template: '<div />' } },
    { path: '/pagos', component: { template: '<div />' } },
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

describe('NavMenu — "Control" group gating on ADM_READ_ROLES / ADM_READ_ADMINS', () => {
  beforeEach(() => {
    mockPermissions.value = []
  })

  it('shows "Control" > "Roles" only when the user holds ADM_READ_ROLES', async () => {
    mockPermissions.value = ['ADM_READ_ROLES']
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Control')
    expect(wrapper.text()).toContain('Roles')
    expect(wrapper.text()).not.toContain('Accesos')
  })

  it('shows "Control" > "Accesos" only when the user holds ADM_READ_ADMINS', async () => {
    mockPermissions.value = ['ADM_READ_ADMINS']
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Control')
    expect(wrapper.text()).toContain('Accesos')
    expect(wrapper.text()).not.toContain('Roles')
  })

  it('shows both "Roles" and "Accesos" when the user holds both permissions', async () => {
    mockPermissions.value = ['ADM_READ_ROLES', 'ADM_READ_ADMINS']
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Roles')
    expect(wrapper.text()).toContain('Accesos')
  })

  it('hides the entire "Control" group when the user lacks both permissions', async () => {
    mockPermissions.value = []
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Control')
    expect(wrapper.text()).not.toContain('Roles')
    expect(wrapper.text()).not.toContain('Accesos')
  })
})

describe('NavMenu — top-level order', () => {
  it('orders top-level groups Inicio, Usuarios, Pagos, Control', async () => {
    mockPermissions.value = [
      'ADM_READ_USERS',
      'ADM_READ_PAYMENTS',
      'ADM_READ_ROLES',
      'ADM_READ_ADMINS',
    ]
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    const text = wrapper.text()
    const inicioIdx = text.indexOf('Inicio')
    const usuariosIdx = text.indexOf('Usuarios')
    const pagosIdx = text.indexOf('Pagos')
    const controlIdx = text.indexOf('Control')

    expect(inicioIdx).toBeLessThan(usuariosIdx)
    expect(usuariosIdx).toBeLessThan(pagosIdx)
    expect(pagosIdx).toBeLessThan(controlIdx)
  })
})
