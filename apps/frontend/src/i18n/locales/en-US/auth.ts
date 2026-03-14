export const login = {
  title: 'Sign in to your account',
  email: 'Email',
  emailPlaceholder: 'Email address',
  password: 'Password',
  passwordPlaceholder: 'Password',
  submit: 'Sign in',
  submitting: 'Signing in...',
  noAccount: "Don't have an account?",
  registerLink: 'Sign up',
  forgotPassword: 'Forgot Password?',
  failed: 'Login failed',
  INVALID_CREDENTIALS: 'Invalid email or password',
} as const

export const auth = {
  INVALID_CREDENTIALS: 'Invalid email or password',
} as const

export const register = {
  title: 'Create Account',
  email: 'Email',
  emailPlaceholder: 'Email address',
  password: 'Password',
  passwordPlaceholder: 'Enter password (6-100 characters)',
  name: 'Username',
  namePlaceholder: 'Enter username (2-50 characters)',
  confirmPassword: 'Confirm Password',
  confirmPasswordPlaceholder: 'Please enter password again',
  submit: 'Register',
  submitting: 'Registering...',
  hasAccount: 'Already have an account?',
  loginLink: 'Login Now',
  failed: 'Registration failed',
} as const

export const forgotPassword = {
  title: 'Find Password',
  description: 'Enter your registered email, we will send a reset link',
  submit: 'Send Reset Link',
  submitting: 'Sending...',
  successTitle: 'Reset Link Sent',
  successMessage:
    'If this email is registered, we have sent the reset link to your email. Please check.',
  backToLogin: 'Back to Login',
  failed: 'Request failed',
} as const

export const resetPassword = {
  title: 'Reset Password',
  newPassword: 'New Password',
  newPasswordPlaceholder: 'Please enter new password',
  confirmNewPassword: 'Confirm New Password',
  confirmNewPasswordPlaceholder: 'Please enter new password again',
  submit: 'Reset Password',
  submitting: 'Resetting...',
  successTitle: 'Password Reset Successful',
  successMessage: 'Your password has been reset successfully. Please login with your new password.',
  invalidToken: 'Reset link is invalid or expired',
  goToLogin: 'Go to Login',
  failed: 'Password reset failed',
} as const
