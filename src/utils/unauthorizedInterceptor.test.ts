import { describe, expect, it, vi } from 'vitest'
import axios, { AxiosError } from 'axios'
import type { AxiosInstance } from 'axios'
import { installUnauthorizedInterceptor } from '@/utils/unauthorizedInterceptor'

const instanceReplying = (status: number, data: unknown = {}): AxiosInstance => {
  const instance = axios.create()
  instance.defaults.adapter = async (config) => {
    const response = { data, status, statusText: '', headers: {}, config }
    if (status >= 400) {
      throw new AxiosError('failed', undefined, config, null, response)
    }
    return response
  }
  return instance
}

describe('installUnauthorizedInterceptor', () => {
  it('calls the handler with the server msg on a 401 and still rejects', async () => {
    const onUnauthorized = vi.fn()
    const instance = instanceReplying(401, { res: false, msg: 'Tu cuenta está desactivada.' })
    installUnauthorizedInterceptor(instance, onUnauthorized)

    await expect(instance.get('api/admin/payments')).rejects.toBeTruthy()
    expect(onUnauthorized).toHaveBeenCalledWith('Tu cuenta está desactivada.')
  })

  it('calls the handler without a message when the body has no msg', async () => {
    const onUnauthorized = vi.fn()
    const instance = instanceReplying(401, { message: 'Unauthenticated.' })
    installUnauthorizedInterceptor(instance, onUnauthorized)

    await expect(instance.get('api/admin/admin')).rejects.toBeTruthy()
    expect(onUnauthorized).toHaveBeenCalledWith(undefined)
  })

  it.each(['api/admin/login', '/api/admin/login', 'sanctum/csrf-cookie'])(
    'does not intercept a 401 on %s (no login loop)',
    async (url) => {
      const onUnauthorized = vi.fn()
      const instance = instanceReplying(401, { msg: 'Las credenciales son incorrectas.' })
      installUnauthorizedInterceptor(instance, onUnauthorized)

      await expect(instance.post(url, {})).rejects.toBeTruthy()
      expect(onUnauthorized).not.toHaveBeenCalled()
    },
  )

  it.each([422, 429, 403, 500])('ignores a %s response', async (status) => {
    const onUnauthorized = vi.fn()
    const instance = instanceReplying(status)
    installUnauthorizedInterceptor(instance, onUnauthorized)

    await expect(instance.get('api/admin/payments')).rejects.toBeTruthy()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('passes successful responses through', async () => {
    const onUnauthorized = vi.fn()
    const instance = instanceReplying(200, { ok: true })
    installUnauthorizedInterceptor(instance, onUnauthorized)

    const res = await instance.get('api/admin/payments')
    expect(res.data).toEqual({ ok: true })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})
