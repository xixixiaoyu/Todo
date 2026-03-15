import { describe, it, expect, vi } from 'vitest'
import { ServiceUnavailableException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { StorageService, type UploadedFile } from '@/upload/storage.service'

class MockConfigService {
  constructor(private readonly values: Record<string, string>) {}

  get<T = string>(key: string, defaultValue?: T): T {
    const value = this.values[key]
    if (value === undefined) {
      return defaultValue as T
    }
    return value as T
  }
}

function createService(config: Record<string, string>) {
  return new StorageService(new MockConfigService(config) as unknown as ConfigService)
}

function createUploadedFile(): UploadedFile {
  return {
    originalname: 'notes.txt',
    mimetype: 'text/plain',
    size: 5,
    buffer: Buffer.from('hello'),
  }
}

describe('StorageService', () => {
  it('rejects upload when S3 credentials are missing', async () => {
    const service = createService({
      S3_BUCKET: 'lumina-uploads',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: '',
      S3_SECRET_ACCESS_KEY: '',
    })

    service.onModuleInit()

    await expect(service.upload(createUploadedFile())).rejects.toThrow(ServiceUnavailableException)
    await expect(service.upload(createUploadedFile())).rejects.toThrow(
      'upload.STORAGE_NOT_CONFIGURED',
    )
  })

  it('uploads file when S3 credentials are configured', async () => {
    const service = createService({
      S3_BUCKET: 'lumina-uploads',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'test-key',
      S3_SECRET_ACCESS_KEY: 'test-secret',
    })

    service.onModuleInit()

    const send = vi.fn().mockResolvedValue({})
    Object.defineProperty(service, 's3Client', {
      value: { send },
      configurable: true,
      writable: true,
    })

    const result = await service.upload(createUploadedFile())

    expect(send).toHaveBeenCalledTimes(1)
    expect(result.bucket).toBe('lumina-uploads')
    expect(result.mimetype).toBe('text/plain')
    expect(result.key.startsWith('uploads/')).toBe(true)
  })
})
