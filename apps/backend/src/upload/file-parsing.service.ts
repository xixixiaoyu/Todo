import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { extname } from 'path'
import { PDFParse } from 'pdf-parse'
import * as mammoth from 'mammoth'
import * as XLSX from 'xlsx'

@Injectable()
export class FileParsingService {
  private readonly logger = new Logger(FileParsingService.name)

  /**
   * 解析上传的文件并提取文本内容
   */
  async parseFile(file: Express.Multer.File): Promise<string> {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const ext = extname(originalName).toLowerCase()

    try {
      switch (ext) {
        case '.pdf':
          return await this.parsePdf(file.buffer)
        case '.docx':
          return await this.parseDocx(file.buffer)
        case '.xlsx':
        case '.xls':
          return this.parseExcel(file.buffer)
        case '.txt':
        case '.md':
        case '.json':
        case '.csv':
        case '.ts':
        case '.js':
        case '.py':
          return file.buffer.toString('utf-8')
        default:
          throw new BadRequestException(`Unsupported file type: ${ext}`)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(`Failed to parse file ${originalName}: ${message}`)
      throw new BadRequestException(`File parsing failed: ${message}`)
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

  private parseExcel(buffer: Buffer): Promise<string> {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    let text = ''
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName]
      text += `Sheet: ${sheetName}\n`
      text += XLSX.utils.sheet_to_csv(worksheet)
      text += '\n'
    })
    return Promise.resolve(text)
  }
}
