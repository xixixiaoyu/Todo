import { Injectable, Logger } from '@nestjs/common'
import { MailerService } from '@nestjs-modules/mailer'
import { I18nService, I18nContext } from 'nestjs-i18n'

export interface SendMailOptions {
  to: string | string[]
  subject: string
  text?: string
  html?: string
}

/**
 * 邮件服务
 * 封装邮件发送逻辑，支持文本和 HTML 邮件
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)

  constructor(
    private readonly mailerService: MailerService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * 获取当前语言
   */
  private getLang(): string {
    try {
      return I18nContext.current()?.lang || 'zh-CN'
    } catch {
      return 'zh-CN'
    }
  }

  /**
   * 发送邮件
   */
  async send(options: SendMailOptions): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      })
      this.logger.log(`邮件发送成功: ${options.subject} -> ${options.to}`)
      return true
    } catch (err) {
      const error = err as Error
      this.logger.error(`邮件发送失败: ${error.message}`, error.stack)
      return false
    }
  }

  /**
   * 发送验证码邮件
   */
  async sendVerificationCode(to: string, code: string, lang?: string): Promise<boolean> {
    const l = lang || this.getLang()
    const subject = this.i18n.t('common.mail.VERIFICATION_CODE_SUBJECT', { lang: l })
    const title = this.i18n.t('common.mail.VERIFICATION_CODE_TITLE', { lang: l })
    const content = this.i18n.t('common.mail.VERIFICATION_CODE_CONTENT', { lang: l })
    const footer = this.i18n.t('common.mail.VERIFICATION_CODE_FOOTER', { lang: l })

    return this.send({
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${title}</h2>
          <p>${content}</p>
          <div style="font-size: 32px; font-weight: bold; color: #4F46E5; padding: 20px; background: #F3F4F6; border-radius: 8px; text-align: center;">
            ${code}
          </div>
          <p style="color: #6B7280; margin-top: 20px;">${footer}</p>
        </div>
      `,
    })
  }

  /**
   * 发送密码重置邮件
   */
  async sendPasswordReset(to: string, resetLink: string, lang?: string): Promise<boolean> {
    const l = lang || this.getLang()
    const subject = this.i18n.t('common.mail.PASSWORD_RESET_SUBJECT', { lang: l })
    const title = this.i18n.t('common.mail.PASSWORD_RESET_TITLE', { lang: l })
    const content = this.i18n.t('common.mail.PASSWORD_RESET_CONTENT', { lang: l })
    const buttonLabel = this.i18n.t('common.mail.PASSWORD_RESET_BUTTON', { lang: l })
    const footer = this.i18n.t('common.mail.PASSWORD_RESET_FOOTER', { lang: l })
    const expiry = this.i18n.t('common.mail.PASSWORD_RESET_EXPIRY', { lang: l })

    return this.send({
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${title}</h2>
          <p>${content}</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            ${buttonLabel}
          </a>
          <p style="color: #6B7280;">${footer}</p>
          <p style="color: #6B7280; font-size: 12px;">${expiry}</p>
        </div>
      `,
    })
  }
}
