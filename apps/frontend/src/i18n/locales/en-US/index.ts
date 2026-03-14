import { common } from './common'
import { home } from './home'
import { login, auth, register, forgotPassword, resetPassword } from './auth'
import { password } from './password'
import { validation } from './validation'
import { notFound } from './not-found'
import { todo } from './todo'
import { statistics } from './statistics'
import { pomodoro } from './pomodoro'
import { ai } from './ai'

export default {
  common,
  home,
  login,
  auth,
  register,
  forgotPassword,
  resetPassword,
  password,
  validation,
  notFound,
  todo,
  statistics,
  pomodoro,
  ai,
} as const
