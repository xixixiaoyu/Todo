import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { PassportModule } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { ZodValidationPipe } from 'nestjs-zod'
import fastifyCookie from '@fastify/cookie'
import type { ApiResponse } from '@lumina/shared'
import { AllExceptionsFilter, SanitizeInterceptor, TransformInterceptor } from '@/common'
import { AuthController } from '@/auth/auth.controller'
import { AuthService } from '@/auth/auth.service'
import { JwtStrategy } from '@/auth/jwt.strategy'
import { PasswordService } from '@/auth/password.service'
import { TokenService } from '@/auth/token.service'
import { UsersService } from '@/users/users.service'
import { PrismaService } from '@/prisma/prisma.service'
import { RedisService } from '@/redis/redis.service'
import { MailService } from '@/mail/mail.service'
import { TodosController } from '@/todos/todos.controller'
import { TodosService } from '@/todos/todos.service'
import { TodoSyncService } from '@/todos/todos-sync.service'
import { EventsGateway } from '@/events/events.gateway'

type InMemoryUser = {
  id: number
  email: string
  name: string
  password: string | null
  avatar: string | null
  googleId: string | null
  resetPasswordToken: string | null
  resetPasswordExpires: Date | null
  createdAt: Date
  updatedAt: Date
}

type InMemoryTodo = {
  id: string
  title: string
  completed: boolean
  order: number
  isPinned: boolean
  parentId: string | null
  version: number
  dueAt: Date | null
  remindAt: Date | null
  remindedAt: Date | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  deletedAt: Date | null
  pomodoroCount: number
  userId: number
}

type InMemoryTombstone = {
  userId: number
  todoId: string
  deletedAt: Date
}

type InMemoryPrismaClient = {
  user: {
    findUnique: (args: { where: { id?: number; email?: string } }) => Promise<InMemoryUser | null>
    findFirst: (args: { where: Record<string, unknown> }) => Promise<InMemoryUser | null>
    findMany: () => Promise<InMemoryUser[]>
    create: (args: {
      data: { email: string; name: string; password: string }
    }) => Promise<InMemoryUser>
    update: (args: {
      where: { id: number }
      data: Record<string, unknown>
    }) => Promise<InMemoryUser | null>
  }
  todo: {
    findMany: (args: {
      where: {
        userId: number
        deletedAt?: null | { not: null }
        updatedAt?: { gte: Date }
      }
      select?: Record<string, boolean>
    }) => Promise<Array<Record<string, unknown>>>
    findUnique: (args: {
      where: { id: string }
      select?: Record<string, boolean>
    }) => Promise<Record<string, unknown> | null>
    findFirst: (args: { where: { id: string; userId: number } }) => Promise<InMemoryTodo | null>
    upsert: (args: {
      where: { id: string }
      update: Record<string, unknown>
      create: Record<string, unknown>
      select?: Record<string, boolean>
    }) => Promise<Record<string, unknown>>
    update: (args: {
      where: { id: string }
      data: Record<string, unknown>
      select?: Record<string, boolean>
    }) => Promise<Record<string, unknown> | null>
    delete: (args: { where: { id: string } }) => Promise<InMemoryTodo | null>
    deleteMany: (args: {
      where: { userId: number; deletedAt?: { not: null } }
    }) => Promise<{ count: number }>
  }
  todoTombstone: {
    findUnique: (args: {
      where: { userId_todoId: { userId: number; todoId: string } }
      select?: { deletedAt?: boolean }
    }) => Promise<{ deletedAt: Date } | InMemoryTombstone | null>
    findMany: (args: {
      where: { userId: number; deletedAt?: { gte: Date } }
      select?: { todoId?: boolean }
    }) => Promise<Array<{ todoId: string } | InMemoryTombstone>>
    upsert: (args: {
      where: { userId_todoId: { userId: number; todoId: string } }
      update: { deletedAt: Date }
      create: { userId: number; todoId: string; deletedAt?: Date }
    }) => Promise<InMemoryTombstone>
    createMany: (args: {
      data: Array<{ userId: number; todoId: string; deletedAt: Date }>
      skipDuplicates?: boolean
    }) => Promise<{ count: number }>
  }
  $transaction: <T>(cb: (tx: InMemoryPrismaClient) => Promise<T>) => Promise<T>
}

function pickSelected<T extends Record<string, unknown>>(
  value: T,
  select?: Record<string, boolean>,
): Partial<T> | T {
  if (!select) return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(select)) {
    if (select[key]) out[key] = value[key]
  }
  return out as Partial<T>
}

function createInMemoryPrisma() {
  let nextUserId = 1
  const usersById = new Map<number, InMemoryUser>()
  const usersByEmail = new Map<string, InMemoryUser>()
  const todosById = new Map<string, InMemoryTodo>()
  const tombstonesByKey = new Map<string, InMemoryTombstone>()

  const makeTombstoneKey = (userId: number, todoId: string) => `${userId}:${todoId}`

  const prisma: InMemoryPrismaClient = {
    user: {
      findUnique: async (args: { where: { id?: number; email?: string } }) => {
        if (typeof args.where.id === 'number') {
          const user = usersById.get(args.where.id)
          return user ? { ...user } : null
        }
        if (typeof args.where.email === 'string') {
          const user = usersByEmail.get(args.where.email)
          return user ? { ...user } : null
        }
        return null
      },
      findFirst: async (args: { where: Record<string, unknown> }) => {
        const entries = Array.from(usersById.values())
        const match = entries.find((u) => {
          for (const [k, v] of Object.entries(args.where)) {
            const value = (u as unknown as Record<string, unknown>)[k]
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              const obj = v as Record<string, unknown>
              if (obj.gt instanceof Date) {
                if (!(value instanceof Date) || value <= obj.gt) return false
                continue
              }
            }
            if (value !== v) return false
          }
          return true
        })
        return match ? { ...match } : null
      },
      findMany: async () => Array.from(usersById.values()).map((u) => ({ ...u })),
      create: async (args: { data: { email: string; name: string; password: string } }) => {
        const now = new Date()
        const user: InMemoryUser = {
          id: nextUserId++,
          email: args.data.email,
          name: args.data.name,
          password: args.data.password,
          avatar: null,
          googleId: null,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          createdAt: now,
          updatedAt: now,
        }
        usersById.set(user.id, user)
        usersByEmail.set(user.email, user)
        return { ...user }
      },
      update: async (args: { where: { id: number }; data: Record<string, unknown> }) => {
        const existing = usersById.get(args.where.id)
        if (!existing) return null
        const updatedAt = new Date()
        const next: InMemoryUser = {
          ...existing,
          ...(args.data as Partial<InMemoryUser>),
          updatedAt,
        }
        if (typeof (args.data as Record<string, unknown>).email === 'string') {
          usersByEmail.delete(existing.email)
          usersByEmail.set(next.email, next)
        } else {
          usersByEmail.set(next.email, next)
        }
        usersById.set(next.id, next)
        return { ...next }
      },
    },
    todo: {
      findMany: async (args: {
        where: {
          userId: number
          deletedAt?: null | { not: null }
          updatedAt?: { gte: Date }
        }
        select?: Record<string, boolean>
      }) => {
        const list = Array.from(todosById.values()).filter((t) => t.userId === args.where.userId)
        const filtered = list.filter((t) => {
          if (args.where.updatedAt?.gte && t.updatedAt < args.where.updatedAt.gte) return false
          if (args.where.deletedAt === null && t.deletedAt !== null) return false
          if (args.where.deletedAt && 'not' in args.where.deletedAt && t.deletedAt === null)
            return false
          return true
        })
        return filtered.map((t) => pickSelected({ ...t }, args.select))
      },
      findUnique: async (args: { where: { id: string }; select?: Record<string, boolean> }) => {
        const t = todosById.get(args.where.id)
        return t ? pickSelected({ ...t }, args.select) : null
      },
      findFirst: async (args: { where: { id: string; userId: number } }) => {
        const t = todosById.get(args.where.id)
        if (!t || t.userId !== args.where.userId) return null
        return { ...t }
      },
      upsert: async (args: {
        where: { id: string }
        update: Record<string, unknown>
        create: Record<string, unknown>
        select?: Record<string, boolean>
      }) => {
        const existing = todosById.get(args.where.id)
        const base = existing ? existing : (args.create as unknown as InMemoryTodo)
        const next = {
          ...base,
          ...(existing ? args.update : args.create),
        } as InMemoryTodo
        todosById.set(next.id, next)
        return pickSelected({ ...next }, args.select)
      },
      update: async (args: {
        where: { id: string }
        data: Record<string, unknown>
        select?: Record<string, boolean>
      }) => {
        const existing = todosById.get(args.where.id)
        if (!existing) return null
        const data = args.data as Record<string, unknown>
        const version = data.version
        const nextVersion =
          version && typeof version === 'object' && 'increment' in version
            ? existing.version + Number((version as Record<string, unknown>).increment ?? 0)
            : ((data.version as number | undefined) ?? existing.version)
        const next: InMemoryTodo = {
          ...existing,
          ...(data as Partial<InMemoryTodo>),
          version: nextVersion,
        }
        todosById.set(next.id, next)
        return pickSelected({ ...next }, args.select)
      },
      delete: async (args: { where: { id: string } }) => {
        const existing = todosById.get(args.where.id)
        if (!existing) return null
        todosById.delete(args.where.id)
        return { ...existing }
      },
      deleteMany: async (args: { where: { userId: number; deletedAt?: { not: null } } }) => {
        const idsToDelete: string[] = []
        for (const t of todosById.values()) {
          if (t.userId !== args.where.userId) continue
          if (args.where.deletedAt && 'not' in args.where.deletedAt && t.deletedAt === null)
            continue
          idsToDelete.push(t.id)
        }
        for (const id of idsToDelete) todosById.delete(id)
        return { count: idsToDelete.length }
      },
    },
    todoTombstone: {
      findUnique: async (args: {
        where: { userId_todoId: { userId: number; todoId: string } }
        select?: { deletedAt?: boolean }
      }) => {
        const key = makeTombstoneKey(
          args.where.userId_todoId.userId,
          args.where.userId_todoId.todoId,
        )
        const existing = tombstonesByKey.get(key)
        if (!existing) return null
        if (args.select?.deletedAt) return { deletedAt: existing.deletedAt }
        return { ...existing }
      },
      findMany: async (args: {
        where: { userId: number; deletedAt?: { gte: Date } }
        select?: { todoId?: boolean }
      }) => {
        const list = Array.from(tombstonesByKey.values()).filter(
          (t) => t.userId === args.where.userId,
        )
        const filtered = list.filter((t) => {
          if (args.where.deletedAt?.gte && t.deletedAt < args.where.deletedAt.gte) return false
          return true
        })
        return filtered.map((t) => (args.select?.todoId ? { todoId: t.todoId } : { ...t }))
      },
      upsert: async (args: {
        where: { userId_todoId: { userId: number; todoId: string } }
        update: { deletedAt: Date }
        create: { userId: number; todoId: string; deletedAt?: Date }
      }) => {
        const key = makeTombstoneKey(
          args.where.userId_todoId.userId,
          args.where.userId_todoId.todoId,
        )
        const existing = tombstonesByKey.get(key)
        const deletedAt = existing ? args.update.deletedAt : (args.create.deletedAt ?? new Date())
        const next: InMemoryTombstone = {
          userId: args.where.userId_todoId.userId,
          todoId: args.where.userId_todoId.todoId,
          deletedAt,
        }
        tombstonesByKey.set(key, next)
        return { ...next }
      },
      createMany: async (args: {
        data: Array<{ userId: number; todoId: string; deletedAt: Date }>
        skipDuplicates?: boolean
      }) => {
        for (const item of args.data) {
          const key = makeTombstoneKey(item.userId, item.todoId)
          if (args.skipDuplicates && tombstonesByKey.has(key)) continue
          tombstonesByKey.set(key, { ...item })
        }
        return { count: args.data.length }
      },
    },
    $transaction: async <T>(cb: (tx: InMemoryPrismaClient) => Promise<T>) => cb(prisma),
  }

  return prisma
}

function createInMemoryRedis() {
  const store = new Map<string, { value: unknown; expiresAtMs: number | null }>()

  const now = () => Date.now()
  const isExpired = (entry: { expiresAtMs: number | null }) =>
    typeof entry.expiresAtMs === 'number' && entry.expiresAtMs <= now()

  const buildKey = (key: string, prefix?: string) => (prefix ? `${prefix}:${key}` : key)

  const redis = {
    async get<T>(key: string, options?: { prefix?: string }): Promise<T | undefined> {
      const fullKey = buildKey(key, options?.prefix)
      const entry = store.get(fullKey)
      if (!entry) return undefined
      if (isExpired(entry)) {
        store.delete(fullKey)
        return undefined
      }
      return entry.value as T
    },
    async set<T>(
      key: string,
      value: T,
      options?: { prefix?: string; ttl?: number },
    ): Promise<void> {
      const fullKey = buildKey(key, options?.prefix)
      const expiresAtMs = typeof options?.ttl === 'number' ? now() + options.ttl * 1000 : null
      store.set(fullKey, { value, expiresAtMs })
    },
    async del(key: string, options?: { prefix?: string }): Promise<void> {
      store.delete(buildKey(key, options?.prefix))
    },
    async delMany(keys: string[], options?: { prefix?: string }): Promise<void> {
      for (const key of keys) store.delete(buildKey(key, options?.prefix))
    },
    async reset(): Promise<void> {
      store.clear()
    },
    async has(key: string, options?: { prefix?: string }): Promise<boolean> {
      const val = await redis.get(key, options)
      return val !== undefined
    },
  }

  return redis as unknown as RedisService
}

function createConfigService(overrides?: Record<string, unknown>) {
  const config: Record<string, unknown> = {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret',
    JWT_REFRESH_SECRET: 'test-jwt-secret',
    JWT_ACCESS_EXPIRES_IN: 900,
    JWT_REFRESH_EXPIRES_IN: 604800,
    ...overrides,
  }

  const configService: Pick<ConfigService, 'get'> = {
    get: <T>(key: string, defaultValue?: T) => {
      if (key in config) return config[key] as T
      return defaultValue
    },
  }

  return configService as unknown as ConfigService
}

function createMailService() {
  const mail: Pick<MailService, 'send' | 'sendPasswordReset' | 'sendVerificationCode'> = {
    async send() {
      return true
    },
    async sendPasswordReset() {
      return true
    },
    async sendVerificationCode() {
      return true
    },
  }
  return mail as unknown as MailService
}

function createEventsGateway() {
  const events: Pick<EventsGateway, 'broadcastSyncNotify'> = {
    broadcastSyncNotify() {
      //
    },
  }
  return events as unknown as EventsGateway
}

export async function createE2eApp() {
  const prisma = createInMemoryPrisma()
  const redis = createInMemoryRedis()
  const config = createConfigService()
  const mail = createMailService()
  const events = createEventsGateway()
  const jwtService = new JwtService({ secret: 'test-jwt-secret' })
  const tokenService = new TokenService(jwtService, config, redis)

  const moduleRef = await Test.createTestingModule({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [AuthController, TodosController],
    providers: [
      AuthService,
      UsersService,
      PasswordService,
      TodosService,
      TodoSyncService,
      JwtStrategy,
      { provide: JwtService, useValue: jwtService },
      { provide: TokenService, useValue: tokenService },
      { provide: PrismaService, useValue: prisma },
      { provide: RedisService, useValue: redis },
      { provide: ConfigService, useValue: config },
      { provide: MailService, useValue: mail },
      { provide: EventsGateway, useValue: events },
    ],
  }).compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  )

  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalInterceptors(new TransformInterceptor())
  app.useGlobalInterceptors(new SanitizeInterceptor())

  const fastify = app.getHttpAdapter().getInstance() as unknown as {
    register: (plugin: unknown, opts?: unknown) => Promise<unknown>
    addHook: (
      name: 'preHandler',
      hook: (
        req: { method: string; headers: Record<string, unknown> },
        reply: { code: (s: number) => { send: (b: unknown) => void } },
      ) => Promise<void>,
    ) => void
  }

  await fastify.register(fastifyCookie, { secret: 'test-cookie-secret' })

  fastify.addHook('preHandler', async (req, reply) => {
    const method = req.method.toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return
    const requestedWith = req.headers['x-requested-with']
    if (!requestedWith) {
      reply.code(403).send({
        success: false,
        message: 'Security check failed: X-Requested-With header is missing',
        timestamp: new Date().toISOString(),
      })
    }
  })

  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

  const inject = async <T = unknown>(opts: {
    method: HttpMethod
    url: string
    headers?: Record<string, string>
    payload?: unknown
  }): Promise<{ statusCode: number; body: ApiResponse<T> | Record<string, unknown> }> => {
    const res = await app.inject({
      method: opts.method,
      url: opts.url,
      headers: opts.headers,
      payload: opts.payload ? JSON.stringify(opts.payload) : undefined,
    })
    return {
      statusCode: res.statusCode,
      body: JSON.parse(res.payload),
    }
  }

  return { app, inject }
}
