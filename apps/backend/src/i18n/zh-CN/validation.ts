export default {
  validation: {
    REQUIRED: '{property} 不能为空',
    INVALID_EMAIL: '请输入有效的邮箱地址',
    MIN_LENGTH: '{property} 至少需要 {min} 个字符',
    MAX_LENGTH: '{property} 不能超过 {max} 个字符',
    INVALID_URL: '请输入有效的 URL 地址',
    PASSWORD_LETTER: '密码必须包含至少一个字母',
    PASSWORD_NUMBER: '密码必须包含至少一个数字',
  },
} as const
