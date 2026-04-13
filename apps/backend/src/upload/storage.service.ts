import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import { extname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { writeFile } from 'fs/promises'

export interface UploadResult {
  key: string
  url: string
  bucket: string
  size: number
  mimetype: string
}

export interface UploadedFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/**
 * 云存储服务
 * 支持 AWS S3 和兼容 S3 协议的存储服务（如阿里云 OSS、MinIO）
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name)
  private s3Client!: S3Client
  private bucket!: string
  private region!: string
  private endpoint: string | undefined
  private storageConfigured = false

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.bucket = this.config.get('S3_BUCKET', 'lumina-uploads')
    this.region = this.config.get('S3_REGION', 'us-east-1')
    this.endpoint = this.config.get('S3_ENDPOINT') // 可选，用于 OSS/MinIO
    const accessKeyId = this.config.get('S3_ACCESS_KEY_ID', '').trim()
    const secretAccessKey = this.config.get('S3_SECRET_ACCESS_KEY', '').trim()
    this.storageConfigured = Boolean(accessKeyId && secretAccessKey)

    if (!this.storageConfigured) {
      this.logger.warn('S3 凭证未配置，上传/删除/签名 URL 接口将不可用')
      return
    }

    this.s3Client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: !!this.endpoint, // OSS/MinIO 需要开启
    })

    this.logger.log(`存储服务已初始化: ${this.bucket} (${this.region})`)
  }

  /**
   * 上传文件到本地存储
   */
  async uploadLocal(file: UploadedFile, folder = 'uploads'): Promise<UploadResult> {
    const ext = extname(file.originalname)
    const filename = `${randomUUID()}${ext}`
    const key = `${folder}/${filename}`

    // 使用相对于当前文件的路径，确保在不同环境下一致
    // __dirname 是 apps/backend/src/upload
    const publicDir = join(__dirname, '..', '..', 'public', folder)
    const filePath = join(publicDir, filename)

    if (!existsSync(publicDir)) {
      mkdirSync(publicDir, { recursive: true })
    }

    await writeFile(filePath, file.buffer)
    this.logger.log(`文件本地上传成功: ${key}`)

    return {
      key,
      url: `/api/public/${key}`,
      bucket: 'local',
      size: file.size,
      mimetype: file.mimetype,
    }
  }

  /**
   * 上传文件到 S3
   */
  async upload(file: UploadedFile, folder = 'uploads'): Promise<UploadResult> {
    this.ensureStorageConfigured()
    const ext = extname(file.originalname)
    const key = `${folder}/${randomUUID()}${ext}`

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // ACL: 'public-read', // 如需公开访问可取消注释
    })

    await this.s3Client.send(command)
    this.logger.log(`文件上传成功: ${key}`)

    return {
      key,
      url: this.getPublicUrl(key),
      bucket: this.bucket,
      size: file.size,
      mimetype: file.mimetype,
    }
  }

  /**
   * 批量上传文件
   */
  async uploadMany(files: UploadedFile[], folder = 'uploads'): Promise<UploadResult[]> {
    return Promise.all(files.map((file) => this.upload(file, folder)))
  }

  /**
   * 删除本地存储文件
   */
  async deleteLocal(key: string): Promise<void> {
    const filename = key.split('/').pop()
    const folder = key.split('/').slice(0, -1).join('/')
    if (!filename) return

    const filePath = join(__dirname, '..', '..', 'public', folder, filename)

    try {
      if (existsSync(filePath)) {
        const { unlink } = await import('fs/promises')
        await unlink(filePath)
        this.logger.log(`文件本地删除成功: ${key}`)
      }
    } catch (error) {
      this.logger.error(`文件本地删除失败: ${key}`, (error as Error).stack)
    }
  }

  /**
   * 删除文件
   */
  async delete(key: string): Promise<void> {
    this.ensureStorageConfigured()
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    await this.s3Client.send(command)
    this.logger.log(`文件删除成功: ${key}`)
  }

  /**
   * 获取预签名 URL（用于临时访问私有文件）
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    this.ensureStorageConfigured()
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    return getSignedUrl(this.s3Client, command, { expiresIn })
  }

  /**
   * 获取公开访问 URL
   */
  private getPublicUrl(key: string): string {
    if (this.endpoint) {
      // OSS/MinIO 格式
      return `${this.endpoint}/${this.bucket}/${key}`
    }
    // AWS S3 格式
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
  }

  private ensureStorageConfigured() {
    if (this.storageConfigured) {
      return
    }

    throw new ServiceUnavailableException('upload.STORAGE_NOT_CONFIGURED')
  }
}
