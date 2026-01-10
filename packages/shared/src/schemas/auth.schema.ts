import { z } from 'zod'
import { ValidationKeys } from './i18n-keys'

/**
 * 共享的邮箱验证规则
 */
export const emailSchema = z
  .string({ required_error: ValidationKeys.REQUIRED })
  .min(1, ValidationKeys.REQUIRED)
  .email(ValidationKeys.INVALID_EMAIL)
  .toLowerCase()
  .trim()

/**
 * 共享的密码基础验证规则
 */
export const passwordSchema = z
  .string({ required_error: ValidationKeys.REQUIRED })
  .min(6, ValidationKeys.MIN_LENGTH)
  .max(100, ValidationKeys.MAX_LENGTH)

/**
 * 登录表单验证 Schema
 */
export const LoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

/**
 * 注册表单验证 Schema
 */
export const RegisterSchema = z.object({
  email: emailSchema,
  name: z
    .string({ required_error: ValidationKeys.REQUIRED })
    .min(2, ValidationKeys.MIN_LENGTH)
    .max(50, ValidationKeys.MAX_LENGTH)
    .trim(),
  password: passwordSchema
    .regex(/[A-Za-z]/, ValidationKeys.PASSWORD_LETTER)
    .regex(/[0-9]/, ValidationKeys.PASSWORD_NUMBER),
})

/**
 * 更新用户信息 Schema
 */
export const UpdateUserSchema = z.object({
  name: z
    .string()
    .min(2, ValidationKeys.MIN_LENGTH)
    .max(50, ValidationKeys.MAX_LENGTH)
    .trim()
    .optional(),
  avatar: z.string().url(ValidationKeys.INVALID_URL).optional().nullable(),
})

/**
 * 用户信息 Schema
 */
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().url().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 * 认证响应 Schema
 * 支持短期访问令牌 + 长期刷新令牌
 */
export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().optional(), // 访问令牌过期时间（秒）
  user: UserSchema,
})

/**
 * 刷新令牌请求 Schema
 */
export const RefreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: ValidationKeys.REQUIRED })
    .min(1, ValidationKeys.REQUIRED),
})

/**
 * 找回密码请求 Schema
 */
export const ForgotPasswordSchema = z.object({
  email: emailSchema,
})

/**
 * 重置密码 Schema
 */
export const ResetPasswordSchema = z.object({
  token: z.string({ required_error: ValidationKeys.REQUIRED }).min(1, ValidationKeys.REQUIRED),
  password: passwordSchema
    .regex(/[A-Za-z]/, ValidationKeys.PASSWORD_LETTER)
    .regex(/[0-9]/, ValidationKeys.PASSWORD_NUMBER),
})
