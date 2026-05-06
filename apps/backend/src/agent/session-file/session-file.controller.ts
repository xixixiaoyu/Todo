import { Controller, Post, Get, Delete, Param, Body, Query } from '@nestjs/common'
import { existsSync } from 'node:fs'
import { SessionFileRegistry } from './session-file.registry'

interface RegisterBody {
  filepaths: string[]
  label?: string
  sessionId?: string
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  message?: string
  timestamp: string
}

@Controller('api/agent/session-files')
export class SessionFileController {
  constructor(private readonly registry: SessionFileRegistry) {}

  @Post()
  async registerFiles(@Body() body: RegisterBody): Promise<ApiResponse<{ files: unknown[] }>> {
    const { filepaths, label, sessionId } = body

    if (!sessionId) {
      return {
        success: false,
        data: null,
        message: 'sessionId is required',
        timestamp: new Date().toISOString(),
      }
    }

    if (!Array.isArray(filepaths) || filepaths.length === 0) {
      return {
        success: false,
        data: null,
        message: 'filepaths is required and must be a non-empty array',
        timestamp: new Date().toISOString(),
      }
    }

    const files: unknown[] = []
    const errors: string[] = []

    for (const fp of filepaths) {
      if (typeof fp !== 'string' || !fp.trim()) {
        errors.push(`Invalid filepath: ${String(fp)}`)
        continue
      }

      if (!existsSync(fp)) {
        errors.push(`File not found: ${fp}`)
        continue
      }

      const file = this.registry.register({
        sessionId,
        filePath: fp,
        label: label || undefined,
      })
      files.push(file)
    }

    if (files.length === 0) {
      return {
        success: false,
        data: null,
        message: errors.join('\n'),
        timestamp: new Date().toISOString(),
      }
    }

    return {
      success: true,
      data: { files },
      timestamp: new Date().toISOString(),
    }
  }

  @Get()
  async getSessionFiles(
    @Query('sessionId') sessionId: string,
  ): Promise<ApiResponse<{ files: unknown[] }>> {
    if (!sessionId) {
      return {
        success: false,
        data: null,
        message: 'sessionId query parameter is required',
        timestamp: new Date().toISOString(),
      }
    }

    const files = this.registry.findBySession(sessionId)
    return {
      success: true,
      data: { files },
      timestamp: new Date().toISOString(),
    }
  }

  @Delete(':id')
  async removeFile(
    @Param('id') id: string,
    @Query('sessionId') sessionId: string,
  ): Promise<ApiResponse<null>> {
    if (!sessionId) {
      return {
        success: false,
        data: null,
        message: 'sessionId query parameter is required',
        timestamp: new Date().toISOString(),
      }
    }

    const removed = this.registry.removeFromSession(sessionId, id)
    return {
      success: removed,
      data: null,
      message: removed ? 'File removed from session' : 'File not found',
      timestamp: new Date().toISOString(),
    }
  }
}
