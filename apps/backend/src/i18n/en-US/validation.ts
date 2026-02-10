export default {
  validation: {
    REQUIRED: '{property} is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    MIN_LENGTH: '{property} must be at least {min} characters',
    MAX_LENGTH: '{property} must not exceed {max} characters',
    INVALID_URL: 'Please enter a valid URL',
    PASSWORD_LETTER: 'Password must contain at least one letter',
    PASSWORD_NUMBER: 'Password must contain at least one number',
  },
} as const
