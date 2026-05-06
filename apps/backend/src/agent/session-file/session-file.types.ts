export interface SessionFile {
  id: string
  sessionId: string
  filePath: string
  label: string
  mime: string
  size: number
  ext: string
  origin: string
  createdAt: string
}

export interface SessionFileCreateInput {
  sessionId: string
  filePath: string
  label: string
  mime?: string
  size?: number
  ext?: string
  origin?: string
}
