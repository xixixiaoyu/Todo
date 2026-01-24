import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { Pool } from 'pg'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null

  constructor() {
    const databaseUrl = process.env.DATABASE_URL
    const isPostgres =
      databaseUrl?.startsWith('postgresql://') || databaseUrl?.startsWith('postgres://')

    if (isPostgres) {
      const pool = new Pool({ connectionString: databaseUrl })
      const adapter = new PrismaPg(pool)
      super({ adapter })
      this.pool = pool
    } else {
      // SQLite 模式
      const sqlitePath = databaseUrl?.replace('file:', '') || 'dev.db'
      const adapter = new PrismaBetterSqlite3({ url: sqlitePath })
      super({ adapter })
    }
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
    if (this.pool) {
      await this.pool.end()
    }
  }
}
