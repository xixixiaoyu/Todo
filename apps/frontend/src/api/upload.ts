import { httpClient } from './index'
import type { ApiResponse } from '@lumina/shared'

export interface ParseFileResult {
  content: string
}

/**
 * 解析文件内容（上传并解析，不保存）
 */
export async function parseFileApi(file: File): Promise<ApiResponse<ParseFileResult>> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await httpClient.post<ApiResponse<ParseFileResult>>('/upload/parse', formData, {
    headers: {
      'Content-Type': null,
    },
  })

  return response.data
}
