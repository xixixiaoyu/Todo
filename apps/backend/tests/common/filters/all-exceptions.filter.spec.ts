import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { AllExceptionsFilter } from '../../../src/common/filters/all-exceptions.filter'
import { HttpException, HttpStatus, ArgumentsHost, ConflictException, Logger } from '@nestjs/common'
import { I18nContext } from 'nestjs-i18n'

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter
  let mockResponse: {
    status: Mock
    send: Mock
  }
  let mockRequest: { url?: string; method?: string; raw?: { url?: string } }
  let mockArgumentsHost: any // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockI18n: any // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    filter = new AllExceptionsFilter()

    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }
    mockRequest = {
      url: '/test',
      method: 'POST',
      raw: { url: '/test' },
    }
    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
        getNext: vi.fn(),
      }),
    }
    mockI18n = {
      t: vi.fn((key: string) => key),
    }
    vi.spyOn(I18nContext, 'current').mockReturnValue(mockI18n as any) // eslint-disable-line @typescript-eslint/no-explicit-any
  })

  it('should handle normal HttpException', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST)
    filter.catch(exception, mockArgumentsHost as ArgumentsHost)

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Test error',
        statusCode: HttpStatus.BAD_REQUEST,
      }),
    )
  })

  it('should handle business error mapping (e.g., auth.EMAIL_EXISTS)', () => {
    // 使用 ConflictException 模拟业务异常
    const exception = new ConflictException('auth.EMAIL_EXISTS')
    filter.catch(exception, mockArgumentsHost as ArgumentsHost)

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT)
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'auth.EMAIL_EXISTS',
        errors: {
          email: 'auth.EMAIL_EXISTS',
        },
      }),
    )
  })

  it('should handle Zod validation errors with multiple issues', () => {
    const mockZodError = {
      issues: [
        { message: 'validation.REQUIRED', path: ['email'] },
        { message: 'validation.MIN_LENGTH', path: ['password'], minimum: 8 },
      ],
    }
    // 模拟一个看起来像 HttpException 的 Zod 异常
    class MockZodException extends HttpException {
      constructor() {
        super('Validation Failed', HttpStatus.BAD_REQUEST)
      }
      name = 'ZodValidationException'
      getZodError() {
        return mockZodError
      }
    }
    const exception = new MockZodException()

    filter.catch(exception, mockArgumentsHost as ArgumentsHost)

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    const jsonResult = mockResponse.send.mock.calls[0][0]
    expect(jsonResult.success).toBe(false)
    expect(jsonResult.errors).toEqual({
      email: 'validation.REQUIRED',
      password: 'validation.MIN_LENGTH',
    })
    // message should be common.VALIDATION_ERROR
    expect(jsonResult.message).toBe('common.VALIDATION_ERROR')
  })

  it('should handle unknown errors as internal server error', () => {
    const exception = new Error('Database connection failed')
    filter.catch(exception, mockArgumentsHost as ArgumentsHost)

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'common.error.INTERNAL_SERVER_ERROR',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      }),
    )
  })
})
