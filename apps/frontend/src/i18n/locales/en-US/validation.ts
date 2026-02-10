export const validation = {
  REQUIRED: 'is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_TYPE: 'Expected {expected}, but received {received}',
  INVALID_FORMAT: 'Invalid format',
  MIN_LENGTH: 'must be at least {min} characters',
  MAX_LENGTH: 'must not exceed {max} characters',
  MIN_VALUE: 'must be at least {min}',
  MAX_VALUE: 'must not exceed {max}',
  INVALID_URL: 'Please enter a valid URL',
  PASSWORD_LETTER: 'Password must contain at least one letter',
  PASSWORD_NUMBER: 'Password must contain at least one number',
} as const
