import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WsException } from '@nestjs/websockets'
import type { Socket, Server } from 'socket.io'
import { EventsGateway } from '@/events/events.gateway'
import { TokenService } from '@/auth/token.service'

describe('EventsGateway', () => {
  let gateway: EventsGateway

  beforeEach(() => {
    const tokenService = {
      verifyAccessToken: vi.fn(),
      isUserSessionInvalidated: vi.fn(),
    } as unknown as TokenService
    gateway = new EventsGateway(tokenService)
    gateway.server = {
      to: vi.fn(() => ({
        emit: vi.fn(),
        except: vi.fn(() => ({ emit: vi.fn() })),
      })),
      emit: vi.fn(),
      use: vi.fn(),
    } as unknown as Server
  })

  function createSocket(userId: number): Socket {
    return {
      id: 'client-1',
      data: { user: { sub: userId } },
      join: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
      to: vi.fn(() => ({ emit: vi.fn() })),
      broadcast: { emit: vi.fn() },
    } as unknown as Socket
  }

  it('should reject joining another user room', () => {
    const socket = createSocket(1)

    expect(() => gateway.handleJoin({ room: 'user:2' }, socket)).toThrow(WsException)
  })

  it('should allow joining own room', () => {
    const socket = createSocket(1)

    expect(gateway.handleJoin({ room: 'user:1' }, socket)).toEqual({
      success: true,
      room: 'user:1',
    })
  })

  it('should reject sending message to another user room', () => {
    const socket = createSocket(1)

    expect(() => gateway.handleMessage({ content: 'test', room: 'user:2' }, socket)).toThrow(
      WsException,
    )
  })
})
