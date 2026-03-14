import { describe, expect, it } from 'vitest'
import { isApiSuccess, unwrapApiResponse, type ApiResponse } from './common.dto'

describe('common.dto', () => {
  it('unwrapApiResponse returns data for success response', () => {
    const response: ApiResponse<{ token: string }> = {
      success: true,
      data: { token: 'abc' },
      timestamp: '2026-03-14T00:00:00.000Z',
    }

    expect(unwrapApiResponse(response)).toEqual({ token: 'abc' })
    expect(isApiSuccess(response)).toBe(true)
  })

  it('unwrapApiResponse throws message for error response', () => {
    const response: ApiResponse<never> = {
      success: false,
      data: null,
      message: 'request failed',
      statusCode: 400,
      timestamp: '2026-03-14T00:00:00.000Z',
    }

    expect(() => unwrapApiResponse(response)).toThrowError('request failed')
    expect(isApiSuccess(response)).toBe(false)
  })

  it('unwrapApiResponse supports legacy payload without success field', () => {
    const legacyResponse = {
      data: { userId: 1 },
      timestamp: '2026-03-14T00:00:00.000Z',
    } as unknown as ApiResponse<{ userId: number }>

    expect(unwrapApiResponse(legacyResponse)).toEqual({ userId: 1 })
  })

  it('unwrapApiResponse treats non-boolean success as legacy payload', () => {
    const malformedResponse = {
      success: 'true',
      data: { ok: true },
      timestamp: '2026-03-14T00:00:00.000Z',
    } as unknown as ApiResponse<{ ok: boolean }>

    expect(unwrapApiResponse(malformedResponse)).toEqual({ ok: true })
  })
})
