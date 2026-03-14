import { describe, it, expect } from 'vitest'
import { formatUser, formatUsers, type PrismaUser } from './user.utils'

describe('user.utils', () => {
  const mockDate = new Date('2024-01-21T00:00:00.000Z')
  const mockPrismaUser: PrismaUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.png',
    createdAt: mockDate,
    updatedAt: mockDate,
  }

  describe('formatUser', () => {
    it('should format a Prisma user correctly', () => {
      const result = formatUser(mockPrismaUser)
      expect(result).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        avatar: 'https://example.com/avatar.png',
        createdAt: '2024-01-21T00:00:00.000Z',
        updatedAt: '2024-01-21T00:00:00.000Z',
      })
    })

    it('should handle null avatar', () => {
      const userMinimal: PrismaUser = {
        ...mockPrismaUser,
        avatar: null,
      }
      const result = formatUser(userMinimal)
      expect(result.avatar).toBeNull()
    })

    it('should not mutate the input user object', () => {
      const user: PrismaUser = { ...mockPrismaUser }
      const original = structuredClone(user)
      formatUser(user)
      expect(user).toEqual(original)
    })
  })

  describe('formatUsers', () => {
    it('should format an array of Prisma users', () => {
      const users = [mockPrismaUser, { ...mockPrismaUser, id: 2 }]
      const result = formatUsers(users)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(1)
      expect(result[1].id).toBe(2)
    })

    it('should handle empty array', () => {
      expect(formatUsers([])).toEqual([])
    })
  })
})
