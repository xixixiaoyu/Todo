/**
 * Copyright (C) 2024-2025 Mu Yun (牧云) <https://github.com/xixixiaoyu/lumina>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 */

import 'dotenv/config'
import { existsSync } from 'fs'
import { join } from 'path'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ZodValidationPipe, cleanupOpenApiDoc } from 'nestjs-zod'
import { Logger } from 'nestjs-pino'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifyHelmet from '@fastify/helmet'
import fastifyCompress from '@fastify/compress'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { AppModule } from './app.module'
import { AllExceptionsFilter, SanitizeInterceptor, TransformInterceptor } from './common'

/**
 * 应用程序启动入口
 */
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
    { bufferLogs: true },
  )
  // 使用 Pino 作为全局日志器
  const logger = app.get(Logger)
  app.useLogger(logger)
  app.flushLogs()

  const fastify = app.getHttpAdapter().getInstance()
  const register = (
    fastify as unknown as { register: (plugin: unknown, opts?: unknown) => Promise<unknown> }
  ).register.bind(
    fastify as unknown as { register: (plugin: unknown, opts?: unknown) => Promise<unknown> },
  )

  // 1. 启用 CORS (必须尽早调用，确保错误响应也能包含 CORS 头)
  const corsOrigin = process.env.CORS_ORIGIN
  await register(fastifyCors, {
    origin:
      corsOrigin === '*'
        ? true
        : corsOrigin?.split(',').map((o) => o.trim()) || [
            'http://localhost:5173',
            'wails://localhost',
            'http://wails.localhost',
          ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Lang',
      'Accept-Language',
      'X-Socket-ID',
    ],
  })

  const staticRoot = join(__dirname, '..', 'public')
  if (existsSync(staticRoot)) {
    await register(fastifyStatic, {
      root: staticRoot,
      prefix: '/public/',
      decorateReply: false,
    })
  }

  // 设置全局路由前缀
  app.setGlobalPrefix('api')

  // Helmet 安全头（防止 XSS、点击劫持等）
  await register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  await register(fastifyCookie)

  await register(fastifyCompress, {
    threshold: 1024,
    zlibOptions: { level: 6 },
  })

  const uploadMaxSize = Number(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024
  const uploadMaxFiles = Number(process.env.UPLOAD_MAX_FILES) || 10
  await register(fastifyMultipart, {
    limits: {
      fileSize: uploadMaxSize,
      files: uploadMaxFiles,
    },
  })

  fastify.addHook(
    'onSend',
    async (_req: unknown, reply: { header: (k: string, v: string) => void }, payload: unknown) => {
      reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
      return payload
    },
  )

  fastify.addHook(
    'onRequest',
    async (
      req: { method: string; url: string; headers: Record<string, unknown>; ip: string },
      reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } },
    ) => {
      const safeMethods = ['GET', 'HEAD', 'OPTIONS']
      if (safeMethods.includes(req.method)) {
        return
      }

      if (req.url.includes('/api/health') || req.url.includes('/socket.io')) {
        return
      }

      const requestedWith = req.headers['x-requested-with']
      if (!requestedWith) {
        logger.warn(
          { method: req.method, url: req.url, ip: req.ip },
          'CSRF 潜在攻击拦截：缺失 X-Requested-With Header',
        )
        reply.code(403).send({
          success: false,
          message: 'Security check failed: X-Requested-With header is missing',
          timestamp: new Date().toISOString(),
        })
      }
    },
  )

  // 全局 Zod 验证管道（替代 class-validator）
  app.useGlobalPipes(new ZodValidationPipe())

  // 全局异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter())

  // 全局响应转换拦截器（统一 API 响应格式）
  app.useGlobalInterceptors(new TransformInterceptor())

  // 全局 XSS 清理拦截器（输入数据清理）
  app.useGlobalInterceptors(new SanitizeInterceptor())

  // Swagger API 文档配置
  const swaggerConfig = new DocumentBuilder()
    .setTitle('简思 (Lumina) API')
    .setDescription('简思 (Lumina) — 简于形，深于思的高效纯粹 AI 个人待办应用 API 接口文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  // 使用 cleanupOpenApiDoc 处理 Zod Schema 生成的 OpenAPI 文档
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document))
  logger.log('🔒 安全中间件已启用: Helmet, 速率限制, XSS 防护, Gzip 压缩', 'Bootstrap')
  logger.log(`📚 Swagger 文档: http://localhost:${process.env.PORT || 3000}/api/docs`, 'Bootstrap')

  const port = process.env.PORT || 3000
  // 启用优雅退出钩子，处理 SIGINT/SIGTERM 等信号
  app.enableShutdownHooks()

  // 在 Docker 环境下必须监听 0.0.0.0 才能从外部访问
  await app.listen(port, '0.0.0.0')

  const baseUrl = `http://localhost:${port}`
  logger.log(`🚀 服务已启动: ${baseUrl}`, 'Bootstrap')
  logger.log(`📚 Swagger 文档: ${baseUrl}/api/docs`, 'Bootstrap')
  logger.log(`🏥 健康检查 (Liveness): ${baseUrl}/api/health/liveness`, 'Bootstrap')
}

bootstrap().catch((err) => {
  console.error('应用启动失败:', err)
  process.exit(1)
})
