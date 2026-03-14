import { describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { I18nService } from 'nestjs-i18n'
import { Global, Module } from '@nestjs/common'
import { MailModule, MailService, MAIL_TRANSPORTER } from '../../src/mail'

@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useValue: {
        get: <T>(_key: string, defaultValue?: T) => defaultValue,
      },
    },
    {
      provide: I18nService,
      useValue: {
        t: () => '',
      },
    },
  ],
  exports: [ConfigService, I18nService],
})
class TestDepsModule {}

describe('MailModule', () => {
  it('should compile and expose mail providers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestDepsModule, MailModule],
    }).compile()

    expect(moduleRef.get(MailService)).toBeDefined()
    expect(moduleRef.get(MAIL_TRANSPORTER)).toBeDefined()
  })
})
