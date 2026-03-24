export default {
  common: {
    VALIDATION_ERROR: 'Validation failed',
    fields: {
      email: 'Email',
      password: 'Password',
      name: 'Name',
      confirmPassword: 'Confirm Password',
    },
    error: {
      INTERNAL_SERVER_ERROR: 'Internal Server Error',
      TOO_MANY_REQUESTS: 'Too many requests, please try again later',
    },
  },
} as const
