import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Logger, Inject, forwardRef, OnModuleDestroy } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { TodosService } from '../todos/todos.service'

/**
 * WebSocket 事件网关
 * 处理实时通信，支持房间、广播等功能
 */
@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173']
      if (!origin || allowedOrigins.includes(origin) || origin === 'null') {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
  },
  namespace: '/events',
  transports: ['websocket', 'polling'],
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(EventsGateway.name)
  private readonly broadcastTimers = new Map<number, NodeJS.Timeout>()

  constructor(
    @Inject(forwardRef(() => TodosService))
    private readonly todosService: TodosService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket 网关已初始化')
  }

  onModuleDestroy() {
    // 清理所有定时器
    for (const timer of this.broadcastTimers.values()) {
      clearTimeout(timer)
    }
    this.broadcastTimers.clear()
  }

  async handleConnection(client: Socket) {
    try {
      // 验证 Token
      const token =
        client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1]

      if (!token) {
        this.logger.warn(`客户端连接被拒绝: 无 Token [${client.id}]`)
        client.disconnect()
        return
      }

      const payload = await this.jwtService.verifyAsync(token)
      client.data.user = payload

      this.logger.log(`客户端已连接并认证: ${client.id} (User: ${payload.sub})`)

      // 自动加入用户房间
      const userId = payload.sub
      await client.join(`user:${userId}`)
      this.logger.debug(`客户端 ${client.id} 已自动加入房间 user:${userId}`)
    } catch {
      this.logger.warn(`客户端连接认证失败: ${client.id}`)
      client.disconnect()
    }
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
}
