import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { UploadController } from '@/upload/upload.controller'
import type { FastifyRequestWithMultipart, MultipartFile } from '@/common'
import type { UploadedFile } from '@/upload/storage.service'

function createMultipartPart(params: {
  filename: string
  mimetype: string
  content: string
}): MultipartFile {
  return {
    fieldname: 'file',
    filename: params.filename,
    mimetype: params.mimetype,
    toBuffer: async () => Buffer.from(params.content),
  }
}

function createSingleFileRequest(part: MultipartFile): FastifyRequestWithMultipart {
  return {
    file: async () => part,
    files: async function* () {
      yield part
    },
  } as unknown as FastifyRequestWithMultipart
}

describe('UploadController', () => {
  const mockStorageService = {
    upload: vi.fn(),
    uploadMany: vi.fn(),
    delete: vi.fn(),
  }
  const mockFileParsingService = {
    parseFile: vi.fn(),
  }

  let controller: UploadController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new UploadController(mockStorageService as never, mockFileParsingService as never)
  })

  it('rejects unsupported mime type for single upload', async () => {
    const part = createMultipartPart({
      filename: 'legacy.doc',
      mimetype: 'application/msword',
      content: 'doc-content',
    })

    await expect(controller.uploadSingle(createSingleFileRequest(part))).rejects.toThrow(
      BadRequestException,
    )
    expect(mockStorageService.upload).not.toHaveBeenCalled()
  })

  it('rejects generic text mime types that are not in whitelist', async () => {
    const part = createMultipartPart({
      filename: 'page.html',
      mimetype: 'text/html',
      content: '<h1>hello</h1>',
    })

    await expect(controller.uploadSingle(createSingleFileRequest(part))).rejects.toThrow(
      BadRequestException,
    )
    expect(mockStorageService.upload).not.toHaveBeenCalled()
  })

  it('accepts allowed file type and forwards to storage service', async () => {
    const uploaded: UploadedFile = {
      originalname: 'notes.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 12,
      buffer: Buffer.from('hello world!'),
    }
    mockStorageService.upload.mockResolvedValue({
      key: 'uploads/file',
      url: 'https://example.com/file',
      bucket: 'test',
      size: uploaded.size,
      mimetype: uploaded.mimetype,
    })

    const part = createMultipartPart({
      filename: uploaded.originalname,
      mimetype: uploaded.mimetype,
      content: 'hello world!',
    })

    await controller.uploadSingle(createSingleFileRequest(part))

    expect(mockStorageService.upload).toHaveBeenCalledTimes(1)
    expect(mockStorageService.upload.mock.calls[0]![0]).toMatchObject({
      originalname: uploaded.originalname,
      mimetype: uploaded.mimetype,
      size: uploaded.size,
    })
  })
})
