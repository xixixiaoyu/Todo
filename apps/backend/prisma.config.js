// Prisma 7 配置文件
// 使用 .js 扩展名以确保在生产环境（无 TS 环境）下也能正常运行
const path = require('path')

// 尝试加载环境变量（开发环境有用，生产环境通常由 Docker 注入）
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })
} catch (e) {
  // 生产环境可能没有 dotenv 或 .env 文件，忽略错误
}

module.exports = {
  schema: 'prisma/schema',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: 'prisma/migrations',
  },
}
