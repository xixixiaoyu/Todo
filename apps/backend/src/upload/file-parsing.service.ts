import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { extname } from 'path'
import { PDFParse } from 'pdf-parse'
import * as mammoth from 'mammoth'
import { Workbook, type CellValue } from 'exceljs'
import type { UploadedFile } from './storage.service'
import { MAX_PARSED_CONTENT_CHARS, PARSABLE_TEXT_EXTENSIONS } from './upload.constants'

@Injectable()
export class FileParsingService {
  private readonly logger = new Logger(FileParsingService.name)

  /**
   * 解析上传的文件并提取文本内容
   */
  async parseFile(file: UploadedFile): Promise<string> {
    const originalName = file.originalname
    const ext = extname(originalName).toLowerCase()
    const extWithoutDot = ext.replace(/^\./, '')

    try {
      let parsedContent = ''

      switch (ext) {
        case '.pdf':
          parsedContent = await this.parsePdf(file.buffer)
          break
        case '.docx':
          parsedContent = await this.parseDocx(file.buffer)
          break
        case '.xlsx':
        case '.xls':
          parsedContent = await this.parseExcel(file.buffer)
          break
        default:
          if (
            PARSABLE_TEXT_EXTENSIONS.includes(
              extWithoutDot as (typeof PARSABLE_TEXT_EXTENSIONS)[number],
            )
          ) {
            parsedContent = file.buffer.toString('utf-8')
            break
          }
          throw new BadRequestException('upload.UNSUPPORTED_PARSE_FILE_TYPE')
      }

      return this.truncateContent(parsedContent)
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        const response = error.getResponse()
        const messageFromResponse =
          typeof response === 'string'
            ? response
            : typeof response === 'object' && response !== null
              ? (response as { message?: unknown }).message
              : undefined
        const normalizedMessage = Array.isArray(messageFromResponse)
          ? messageFromResponse.find((m): m is string => typeof m === 'string')
          : typeof messageFromResponse === 'string'
            ? messageFromResponse
            : undefined

        if (normalizedMessage?.startsWith('upload.')) {
          throw error
        }
      }

      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to parse file ${originalName}: ${message}`)
      throw new BadRequestException('upload.FILE_PARSING_FAILED')
    }
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    try {
      const pdf = new PDFParse(new Uint8Array(buffer))
      const result = await pdf.getText()
      return result.text
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`PDF parse error: ${message}`)
      throw error
    }
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  private async parseExcel(buffer: Buffer): Promise<string> {
    const workbook = new Workbook()
    const excelBuffer = buffer as unknown as Parameters<Workbook['xlsx']['load']>[0]
    await workbook.xlsx.load(excelBuffer)

    let text = ''
    workbook.worksheets.forEach((worksheet) => {
      const sheetName = worksheet.name
      text += `Sheet: ${sheetName}\n`
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        const rowValues = (row.values as CellValue[]).slice(1)
        const csvLine = rowValues.map((cell) => this.stringifyExcelCell(cell)).join(',')
        text += `${csvLine}\n`
      })
      text += '\n'
    })
    return text
  }

  private stringifyExcelCell(cell: CellValue): string {
    if (cell === null || cell === undefined) {
      return ''
    }

    if (typeof cell === 'object') {
      if ('text' in cell && typeof cell.text === 'string') {
        return cell.text
      }

      if ('result' in cell && typeof cell.result === 'string') {
        return cell.result
      }

      if ('result' in cell && typeof cell.result === 'number') {
        return String(cell.result)
      }

      return JSON.stringify(cell)
    }

    return String(cell)
  }

  private truncateContent(content: string): string {
    if (content.length <= MAX_PARSED_CONTENT_CHARS) {
      return content
    }

    return `${content.slice(0, MAX_PARSED_CONTENT_CHARS)}\n\n...[truncated]`
  }
}
