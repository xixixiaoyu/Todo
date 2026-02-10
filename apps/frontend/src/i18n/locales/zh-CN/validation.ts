export const validation = {
  REQUIRED: '{property} 不能为空',
  INVALID_EMAIL: '请输入有效的邮箱地址',
  INVALID_TYPE: '预期为 {expected}，但收到了 {received}',
  INVALID_FORMAT: '格式无效',
  MIN_LENGTH: '{property} 至少需要 {min} 个字符',
  MAX_LENGTH: '{property} 不能超过 {max} 个字符',
  MIN_VALUE: '{property} 数值不能小于 {min}',
  MAX_VALUE: '{property} 数值不能大于 {max}',
  INVALID_URL: '请输入有效的 URL 地址',
  PASSWORD_LETTER: '密码必须包含至少一个字母',
  PASSWORD_NUMBER: '密码必须包含至少一个数字',
} as const
