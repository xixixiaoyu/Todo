import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
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
  let mockArgumentsHost: ArgumentsHost
  let mockI18n: { t: Mock }

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
    } as unknown as ArgumentsHost
    mockI18n = {
      t: vi.fn((key: string) => key),
    }
    vi.spyOn(I18nContext, 'current').mockReturnValue(
      mockI18n as unknown as ReturnType<typeof I18nContext.current>,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('should handle business error without field mapping', () => {
    const exception = new ConflictException('todo.duplicate')
    filter.catch(exception, mockArgumentsHost as ArgumentsHost)

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT)
    expect(mockResponse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'todo.duplicate',
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
    const jsonResult = mockResponse.send.mock.calls[0]![0]
    expect(jsonResult.success).toBe(false)
    expect(jsonResult.errors).toEqual({
      email: 'validation.REQUIRED',
      password: 'validation.MIN_LENGTH',
    })
    // message should be common.VALIDATION_ERROR
    expect(jsonResult.message).toBe('common.VALIDATION_ERROR')
  })

  it('should log structured issues for Zod validation failures', () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    const mockZodError = {
      issues: [
        {
          message: 'Too big: expected string to have <=500 characters',
          path: ['todos', 0, 'title'],
        },
      ],
    }
    class MockZodException extends HttpException {
      constructor() {
        super('Validation Failed', HttpStatus.BAD_REQUEST)
      }
      name = 'ZodValidationException'
      getZodError() {
        return mockZodError
      }
    }

    filter.catch(new MockZodException(), mockArgumentsHost as ArgumentsHost)

    expect(warnSpy).toHaveBeenCalledTimes(1)
    const warnMessage = warnSpy.mock.calls[0]![0] as string
    expect(warnMessage).toContain('Zod validation failed')
    expect(warnMessage).toContain('POST /test')
    expect(warnMessage).toContain('todos.0.title')
    expect(warnMessage).toContain('expected string to have <=500 characters')
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
