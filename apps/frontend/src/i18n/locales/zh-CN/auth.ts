export const login = {
  title: '登录账户',
  email: '邮箱',
  emailPlaceholder: '邮箱地址',
  password: '密码',
  passwordPlaceholder: '密码',
  submit: '登录',
  submitting: '登录中...',
  noAccount: '还没有账号？',
  registerLink: '立即注册',
  forgotPassword: '忘记密码？',
  failed: '登录失败',
  INVALID_CREDENTIALS: '邮箱或密码错误',
  orContinueWith: '或通过以下方式继续',
} as const

export const auth = {
  INVALID_CREDENTIALS: '邮箱或密码错误',
} as const

export const register = {
  title: '创建账号',
  email: '邮箱',
  emailPlaceholder: '邮箱地址',
  password: '密码',
  passwordPlaceholder: '请输入密码（6-100 个字符）',
  name: '用户名',
  namePlaceholder: '请输入用户名（2-50 个字符）',
  confirmPassword: '确认密码',
  confirmPasswordPlaceholder: '请再次输入密码',
  submit: '注册',
  submitting: '注册中...',
  hasAccount: '已有账号？',
  loginLink: '立即登录',
  failed: '注册失败',
} as const

export const forgotPassword = {
  title: '找回密码',
  description: '输入您的注册邮箱，我们将发送重置链接',
  submit: '发送重置链接',
  submitting: '发送中...',
  successTitle: '重置链接已发送',
  successMessage: '如果该邮箱已注册，我们已将重置链接发送到您的邮箱，请查收',
  backToLogin: '返回登录',
  failed: '请求失败',
} as const

export const resetPassword = {
  title: '重置密码',
  newPassword: '新密码',
  newPasswordPlaceholder: '请输入新密码',
  confirmNewPassword: '确认新密码',
  confirmNewPasswordPlaceholder: '请再次输入新密码',
  submit: '重置密码',
  submitting: '重置中...',
  successTitle: '密码重置成功',
  successMessage: '您的密码已成功重置，请使用新密码登录',
  invalidToken: '重置链接无效或已过期',
  goToLogin: '前往登录',
  failed: '重置密码失败',
} as const
