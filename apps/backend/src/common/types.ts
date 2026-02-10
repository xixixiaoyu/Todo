import type { FastifyReply, FastifyRequest } from 'fastify'

export type FastifyReplyWithCookie = FastifyReply

export type FastifyRequestWithMultipart = FastifyRequest & {
  file: () => Promise<MultipartFile | undefined>
  files: () => AsyncIterableIterator<MultipartFile>
}

export type MultipartFile = {
  fieldname: string
  filename: string
  mimetype: string
  toBuffer: () => Promise<Buffer>
}
