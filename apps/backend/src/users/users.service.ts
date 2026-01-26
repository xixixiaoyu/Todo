import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import type { User, RegisterInput, PrismaUser } from '@lumina/shared'
import { formatUser, formatUsers } from '@lumina/shared'

/**
 * 用户服务
 * 处理用户相关的业务逻辑
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取所有用户
   */
  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      include: { authenticators: true },
    })
    return formatUsers(users as unknown as PrismaUser[])
  }

  /**
   * 根据 ID 获取单个用户
   */
  async findOne(id: number): Promise<User> {
    if (isNaN(id) || id <= 0) {
      throw new NotFoundException('auth.INVALID_USER_ID')
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { authenticators: true },
    })

    if (!user) {
      throw new NotFoundException('auth.USER_ID_NOT_FOUND')
    }

    return formatUser(user as unknown as PrismaUser)
  }

  /**
   * 根据邮箱获取单个用户
   */
  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { authenticators: true },
    })

    if (!user) return null

    return formatUser(user as unknown as PrismaUser)
  }

  /**
   * 根据邮箱获取单个用户（内部使用，包含密码）
   */
  async findInternalByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { authenticators: true },
    })
  }

  /**
   * 创建 Google 用户
   */
  async createWithGoogle(data: {
    email: string
    name: string
    googleId: string
    avatar?: string
  }): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        googleId: data.googleId,
        avatar: data.avatar,
      },
      include: { authenticators: true },
    })
    return formatUser(user as unknown as PrismaUser)
  }

  /**
   * 根据 ID 获取单个用户（内部使用，包含密码）
   */
  async findInternalById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { authenticators: true },
    })
  }

  /**
   * 更新用户信息
   */
  async update(id: number, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
    })
  }

  /**
   * 查找第一个匹配的用户（内部使用）
   */
  async findInternalFirst(where: Prisma.UserWhereInput) {
    return this.prisma.user.findFirst({
      where,
    })
  }

  /**
   * 创建新用户
   */
  async create(createUserDto: RegisterInput): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    })

    if (existingUser) {
      throw new ConflictException('auth.EMAIL_EXISTS')
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10)

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
      },
    })

    return formatUser(user)
  }
}
