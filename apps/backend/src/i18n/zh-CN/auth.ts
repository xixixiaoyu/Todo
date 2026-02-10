export default {
  auth: {
    USER_NOT_FOUND: '用户不存在',
    INVALID_PASSWORD: '密码错误',
    INVALID_CREDENTIALS: '邮箱或密码错误',
    INVALID_REFRESH_TOKEN: '刷新令牌无效',
    EMAIL_EXISTS: '该邮箱已被注册',
    USER_ID_NOT_FOUND: '用户 ID {id} 不存在',
    UNAUTHORIZED: '未授权访问',
    TOKEN_EXPIRED: '令牌已过期',
    INVALID_TOKEN: '令牌无效',
    INVALID_USER_ID: '无效的用户 ID',
    INVALID_RESET_TOKEN: '重置链接无效或已过期',
    CHALLENGE_EXPIRED: '挑战已过期，请重试',
    REGISTRATION_FAILED: 'Passkey 注册失败',
    AUTHENTICATOR_NOT_FOUND: '未找到认证器',
    AUTHENTICATION_FAILED: '认证失败',
  },
} as const
