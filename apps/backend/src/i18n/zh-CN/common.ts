export default {
  common: {
    VALIDATION_ERROR: '数据验证失败',
    fields: {
      email: '邮箱',
      password: '密码',
      name: '姓名',
      confirmPassword: '确认密码',
    },
    error: {
      INTERNAL_SERVER_ERROR: '服务器内部错误',
      TOO_MANY_REQUESTS: '请求过于频繁，请稍后再试',
    },
  },
} as const
