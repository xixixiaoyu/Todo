import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PasswordService } from '../../src/auth/password.service'
import { UsersService } from '../../src/users/users.service'
import { ConfigService } from '@nestjs/config'
import { MailService } from '../../src/mail/mail.service'
import * as bcrypt from 'bcryptjs'
import { BadRequestException } from '@nestjs/common'

describe('PasswordService', () => {
  let service: PasswordService
  let usersService: UsersService
  let configService: ConfigService
  let mailService: MailService

  beforeEach(() => {
    usersService = {
      findInternalByEmail: vi.fn(),
      update: vi.fn(),
      findInternalFirst: vi.fn(),
    } as unknown as UsersService
    configService = {
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    } as unknown as ConfigService
    mailService = {
      sendPasswordReset: vi.fn(),
    } as unknown as MailService

    service = new PasswordService(usersService, configService, mailService)
  })

  describe('hash', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'password123'
      const hashed = await service.hash(password)
      expect(await bcrypt.compare(password, hashed)).toBe(true)
    })
  })

  describe('compare', () => {
    it('should return true for matching passwords', async () => {
      const password = 'password123'
      const hashed = await bcrypt.hash(password, 10)
      const result = await service.compare(password, hashed)
      expect(result).toBe(true)
    })

    it('should return false for non-matching passwords', async () => {
      const hashed = await bcrypt.hash('password123', 10)
      const result = await service.compare('wrong', hashed)
      expect(result).toBe(false)
    })
  })

  describe('requestReset', () => {
    it('should send reset email if user exists', async () => {
      const email = 'test@example.com'
      const user = { id: 1, email }
      vi.mocked(usersService.findInternalByEmail).mockResolvedValue(
        user as unknown as Awaited<ReturnType<typeof usersService.findInternalByEmail>>,
      )

      await service.requestReset(email)

      expect(usersService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          resetPasswordToken: expect.any(String),
          resetPasswordExpires: expect.any(Date),
        }),
      )
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
        email,
        expect.stringContaining('token='),
      )
    })

    it('should not send email if user does not exist (prevention of enumeration)', async () => {
      vi.mocked(usersService.findInternalByEmail).mockResolvedValue(null)

      await service.requestReset('none@example.com')

      expect(usersService.update).not.toHaveBeenCalled()
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('should update password and clear reset token', async () => {
      const token = 'valid-token'
      const user = { id: 1 }
      vi.mocked(usersService.findInternalFirst).mockResolvedValue(
        user as unknown as Awaited<ReturnType<typeof usersService.findInternalFirst>>,
      )

      await service.reset(token, 'new-password')

      expect(usersService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          password: expect.any(String),
          resetPasswordToken: null,
          resetPasswordExpires: null,
        }),
      )
    })

    it('should throw BadRequestException if token is invalid or expired', async () => {
      vi.mocked(usersService.findInternalFirst).mockResolvedValue(null)

      await expect(service.reset('invalid-token', 'password')).rejects.toThrow(BadRequestException)
    })
  })
})
