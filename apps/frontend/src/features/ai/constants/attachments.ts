const TEXT_EXTENSIONS = [
  'ts',
  'js',
  'py',
  'go',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'rs',
  'json',
  'md',
  'txt',
  'csv',
  'yaml',
  'yml',
  'toml',
] as const

const FRONTEND_TEXT_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'text/javascript',
  'application/javascript',
  'text/typescript',
] as const

const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ...FRONTEND_TEXT_MIME_TYPES,
] as const

const DOCUMENT_EXTENSIONS = ['pdf', 'docx', 'xls', 'xlsx', ...TEXT_EXTENSIONS] as const

export const MAX_TOTAL_ATTACHMENTS = 10
export const MAX_ATTACHMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const MAX_PARSED_FILE_CHARS = 60_000
export const MAX_PROMPT_DOC_CHARS_PER_FILE = 20_000
export const MAX_PROMPT_DOC_CHARS_TOTAL = 80_000

export const AI_UPLOAD_ACCEPT = ['image/*', ...DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`)].join(
  ',',
)

function hasExt(filename: string, extensions: readonly string[]): boolean {
  const name = filename.trim().toLowerCase()
  return extensions.some((ext) => name.endsWith(`.${ext}`))
}

export function isAllowedDocument(file: File): boolean {
  return (
    DOCUMENT_MIME_TYPES.includes(file.type as (typeof DOCUMENT_MIME_TYPES)[number]) ||
    hasExt(file.name, DOCUMENT_EXTENSIONS)
  )
}

export function isFrontendParsable(file: File): boolean {
  return (
    FRONTEND_TEXT_MIME_TYPES.includes(file.type as (typeof FRONTEND_TEXT_MIME_TYPES)[number]) ||
    hasExt(file.name, TEXT_EXTENSIONS)
  )
}
