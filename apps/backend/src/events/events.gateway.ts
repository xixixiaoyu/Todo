import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets'
import { Logger, OnModuleDestroy } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { TokenService } from '../auth/token.service'

/**
 * WebSocket 事件网关
 * 处理实时通信，支持房间、广播等功能
 */
@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const corsOrigin = process.env.CORS_ORIGIN || ''
      if (corsOrigin === '*') {
        return callback(null, true)
      }

      const allowedOrigins = corsOrigin.split(',').map((o) => o.trim()) || ['http://localhost:5173']

      // 在生产环境中，允许 origin 为空（某些 Socket.io 握手请求可能不带 Origin，或者同源请求）
      // 同时支持精确匹配和一些常见的调试/开发环境
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin === 'null' ||
        origin.startsWith('wails://') ||
        origin.startsWith('http://wails.localhost') ||
        origin.startsWith('https://wails.localhost')
      ) {
        callback(null, true)
      } else {
        console.warn(
          `[Socket.io] CORS rejection: origin=${origin}, allowedOrigins=${JSON.stringify(allowedOrigins)}`,
        )
        callback(new Error(`Not allowed by CORS: ${origin}`))
      }
    },
    credentials: true,
    allowedHeaders:
      'Content-Type, Authorization, authorization, X-Requested-With, X-Lang, x-lang, Accept-Language, X-Socket-ID', // 显式列出所有标头，避免通配符警告
  },
  namespace: '/events',
  transports: ['polling', 'websocket'],
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(EventsGateway.name)
  private readonly broadcastTimers = new Map<number, NodeJS.Timeout>()

  constructor(private readonly tokenService: TokenService) {}

  private getAuthorizedUserId(client: Socket): number {
    const sub = client.data.user?.sub
    const userId = typeof sub === 'string' ? Number.parseInt(sub, 10) : sub
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new WsException('unauthorized')
    }
    return userId
  }

  private ensureOwnRoomAccess(client: Socket, room: string): void {
    const userId = this.getAuthorizedUserId(client)
    const expectedRoom = `user:${userId}`
    if (room !== expectedRoom) {
      this.logger.warn(`Unauthorized room access attempt: user=${userId}, room=${room}`)
      throw new WsException('forbidden room')
    }
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket 网关已初始化')

    // 添加认证中间件
    server.use((socket, next) => {
      void (async () => {
        try {
          const token =
            socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1]

          if (!token) {
            return next(new Error('unauthorized'))
          }

          const payload = this.tokenService.verifyAccessToken(token)
          const isInvalidated = await this.tokenService.isUserSessionInvalidated(
            payload.sub,
            payload.iat,
          )
          if (isInvalidated) {
            return next(new Error('unauthorized'))
          }
          socket.data.user = payload
          next()
        } catch {
          this.logger.warn(`WebSocket 认证失败: ${socket.id}`)
          next(new Error('unauthorized'))
        }
      })()
    })
  }

  onModuleDestroy() {
    // 清理所有定时器
    for (const timer of this.broadcastTimers.values()) {
      clearTimeout(timer)
    }
    this.broadcastTimers.clear()
  }

  async handleConnection(client: Socket) {
    // 此时 token 已被中间件验证，直接从 data 中获取用户信息
    const user = client.data.user

    if (!user) {
      this.logger.warn(`客户端连接未认证: ${client.id}`)
      client.disconnect()
      return
    }

    this.logger.log(`客户端已连接: ${client.id} (User: ${user.sub})`)

    // 自动加入用户房间
    await client.join(`user:${user.sub}`)
    this.logger.debug(`客户端 ${client.id} 已自动加入房间 user:${user.sub}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`客户端断开: ${client.id}`)
  }

  /**
   * 处理客户端消息
   */
  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: { content: string; room?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug(`收到消息: ${JSON.stringify(data)} from ${client.id}`)

    if (data.room) {
      this.ensureOwnRoomAccess(client, data.room)
      // 发送到指定房间
      this.server.to(data.room).emit('message', {
        senderId: client.id,
        content: data.content,
        timestamp: new Date().toISOString(),
      })
    } else {
      // 广播给所有客户端（除发送者外）
      client.broadcast.emit('message', {
        senderId: client.id,
        content: data.content,
        timestamp: new Date().toISOString(),
      })
    }

    return { success: true }
  }

  /**
   * 广播同步通知给特定用户的所有在线设备
   */
  broadcastSyncNotify(userId: number, excludeClientId?: string) {
    // 后端防抖：500ms 内只发送一次广播给该用户
    const existingTimer = this.broadcastTimers.get(userId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      const room = `user:${userId}`
      if (excludeClientId) {
        this.server.to(room).except(excludeClientId).emit('todos:sync', {
          timestamp: new Date().toISOString(),
        })
      } else {
        this.server.to(room).emit('todos:sync', {
          timestamp: new Date().toISOString(),
        })
      }
      this.broadcastTimers.delete(userId)
    }, 500)

    this.broadcastTimers.set(userId, timer)
  }

  /**
   * 加入房间
   */
  @SubscribeMessage('join')
  handleJoin(@MessageBody() data: { room: string }, @ConnectedSocket() client: Socket) {
    this.ensureOwnRoomAccess(client, data.room)

    const joinPromise = client.join(data.room)
    if (joinPromise) {
      joinPromise.catch((err: Error) => {
        this.logger.error(`加入房间失败: ${data.room}`, err)
      })
    }
    this.logger.log(`${client.id} 加入房间: ${data.room}`)

    // 通知房间内其他成员
    client.to(data.room).emit('user:joined', {
      userId: client.id,
      room: data.room,
    })

    return { success: true, room: data.room }
  }

  /**
   * 离开房间
   */
  @SubscribeMessage('leave')
  handleLeave(@MessageBody() data: { room: string }, @ConnectedSocket() client: Socket) {
    this.ensureOwnRoomAccess(client, data.room)

    const leavePromise = client.leave(data.room)
    if (leavePromise) {
      leavePromise.catch((err: Error) => {
        this.logger.error(`离开房间失败: ${data.room}`, err)
      })
    }
    this.logger.log(`${client.id} 离开房间: ${data.room}`)

    // 通知房间内其他成员
    this.server.to(data.room).emit('user:left', {
      userId: client.id,
      room: data.room,
    })

    return { success: true }
  }

  /**
   * 向指定房间广播消息（供其他服务调用）
   */
  broadcastToRoom(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event, data)
  }

  /**
   * 向所有客户端广播消息（供其他服务调用）
   */
  broadcastToAll(event: string, data: unknown) {
    this.server.emit(event, data)
  }

  /**
   * 向指定 session 的房间发送消息
   * 用于 Agent 异步任务的实时推送
   */
  sendToSession(sessionId: string, event: string, data: unknown) {
    const room = `session:${sessionId}`
    this.server.to(room).emit(event, data)
  }
}
