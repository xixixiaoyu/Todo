import { describe, expect, it } from 'vitest'
import { isApiSuccess, unwrapApiResponse, ApiError } from './common.dto'
import type { ApiResponse } from './common.dto'

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

  it('unwrapApiResponse throws ApiError with statusCode / errors for error response', () => {
    const response: ApiResponse<never> = {
      success: false,
      data: null,
      message: 'request failed',
      statusCode: 400,
      timestamp: '2026-03-14T00:00:00.000Z',
      errors: { email: 'invalid' },
    }

    try {
      unwrapApiResponse(response)
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).message).toBe('request failed')
      expect((e as ApiError).statusCode).toBe(400)
      expect((e as ApiError).errors).toEqual({ email: 'invalid' })
      expect((e as ApiError).timestamp).toBe('2026-03-14T00:00:00.000Z')
    }

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
