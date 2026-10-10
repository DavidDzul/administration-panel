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
    { path: '/control/becas', component: { template: '<div />' } },
    { path: '/pagos', component: { template: '<div />' } },
    { path: '/pagos/por-generacion', component: { template: '<div />' } },
    { path: '/becas-telmex', component: { template: '<div />' } },
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

// sdd/scholarship-telmex-iu-split, design D8: "Configuración de becas" nav
// item, gated directly on ADM_MANAGE_SCHOLARSHIP_SETTINGS (no separate read
// permission exists for this single-value surface) — same "Control" group
// as Roles/Accesos.
describe('NavMenu — "Control" > "Configuración de becas" gating on ADM_MANAGE_SCHOLARSHIP_SETTINGS', () => {
  beforeEach(() => {
    mockPermissions.value = []
  })

  it('shows "Control" > "Configuración de becas" when the user holds ADM_MANAGE_SCHOLARSHIP_SETTINGS alone', async () => {
    mockPermissions.value = ['ADM_MANAGE_SCHOLARSHIP_SETTINGS']
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Control')
    expect(wrapper.text()).toContain('Configuración de becas')
  })

  it('hides "Configuración de becas" when the user lacks ADM_MANAGE_SCHOLARSHIP_SETTINGS', async () => {
    mockPermissions.value = ['ADM_READ_ROLES']
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Control')
    expect(wrapper.text()).not.toContain('Configuración de becas')
  })

  it('hides the entire "Control" group when the user holds none of the three Control permissions', async () => {
    mockPermissions.value = []
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Control')
    expect(wrapper.text()).not.toContain('Configuración de becas')
  })
})

// Spec scenario: '"Lotes de pago" not highlighted on the new route'
// (sdd/pagos-consulta-por-generacion, design D10).
describe('NavMenu — "Pagos" group: "Resumen por generación" sub-item and exact-matching', () => {
  beforeEach(() => {
    mockPermissions.value = []
  })

  it('shows "Pagos" > "Resumen por generación" when the user holds ADM_READ_PAYMENTS', async () => {
    mockPermissions.value = ['ADM_READ_PAYMENTS']
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Pagos')
    expect(wrapper.text()).toContain('Lotes de pago')
    expect(wrapper.text()).toContain('Resumen por generación')
  })

  it('does not highlight "Lotes de pago" while on /pagos/por-generacion', async () => {
    mockPermissions.value = ['ADM_READ_PAYMENTS']
    await router.push('/pagos/por-generacion')
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    const items = wrapper.findAll('.nav-subitem')
    const lotesItem = items.find((item) => item.text() === 'Lotes de pago')
    const resumenItem = items.find((item) => item.text() === 'Resumen por generación')

    expect(lotesItem?.classes()).not.toContain('v-list-item--active')
    expect(resumenItem?.classes()).toContain('v-list-item--active')
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

// sdd/telmex-cobertura-iu, PR4: "Becas Telmex" top-level group, gated on
// ADM_READ_TELMEX_COVERAGE — peer to "Pagos" (operational work on becarios),
// not nested under "Control" (administration-of-the-administration).
describe('NavMenu — "Becas Telmex" group gating on ADM_READ_TELMEX_COVERAGE', () => {
  beforeEach(() => {
    mockPermissions.value = []
  })

  it('shows "Becas Telmex" when the user holds ADM_READ_TELMEX_COVERAGE', async () => {
    mockPermissions.value = ['ADM_READ_TELMEX_COVERAGE']
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Becas Telmex')
  })

  it('hides "Becas Telmex" when the user lacks ADM_READ_TELMEX_COVERAGE', async () => {
    mockPermissions.value = []
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Becas Telmex')
  })

  it('orders "Becas Telmex" after "Pagos" and before "Control"', async () => {
    mockPermissions.value = [
      'ADM_READ_PAYMENTS',
      'ADM_READ_TELMEX_COVERAGE',
      'ADM_READ_ROLES',
    ]
    const wrapper = mountNav()
    await wrapper.vm.$nextTick()

    const text = wrapper.text()
    const pagosIdx = text.indexOf('Pagos')
    const becasTelmexIdx = text.indexOf('Becas Telmex')
    const controlIdx = text.indexOf('Control')

    expect(pagosIdx).toBeLessThan(becasTelmexIdx)
    expect(becasTelmexIdx).toBeLessThan(controlIdx)
  })
})
