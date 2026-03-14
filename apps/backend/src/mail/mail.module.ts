import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport } from 'nodemailer'
import { MailService } from './mail.service'

export const MAIL_TRANSPORTER = Symbol('MAIL_TRANSPORTER')

/**
 * 邮件模块
 * 集成 nodemailer，支持 SMTP 发送邮件
 */
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const user = config.get<string>('MAIL_USER')
        const pass = config.get<string>('MAIL_PASSWORD')
        const secure = String(config.get<string | boolean>('MAIL_SECURE', false)) === 'true'
        const port = Number(config.get<string | number>('MAIL_PORT', 587))

        const transportOptions = {
          host: config.get<string>('MAIL_HOST', 'smtp.example.com'),
          port: Number.isFinite(port) ? port : 587,
          secure,
          ...(user && pass ? { auth: { user, pass } } : {}),
        }

        return createTransport(transportOptions)
      },
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
