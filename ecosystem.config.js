/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path')
const isDocker = process.env.IS_DOCKER === 'true'

module.exports = {
  apps: [
    {
      name: 'todo-backend',
      script: 'dist/apps/backend/src/main.js',
      // 在 Docker 中，目录是扁平的，cwd 为当前目录 (/app)
      // 在本地开发中，cwd 指向 apps/backend
      cwd: isDocker ? './' : path.join(__dirname, 'apps/backend'),
      // Socket.IO 在 cluster + polling 下需要额外 sticky 会话能力，Docker 默认单实例避免会话抖动
      instances: isDocker ? 1 : 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Docker 环境下日志直接输出到控制台，不写文件
      error_file: isDocker ? '/dev/stderr' : path.join(__dirname, 'logs/backend-error.log'),
      out_file: isDocker ? '/dev/stdout' : path.join(__dirname, 'logs/backend-out.log'),
      merge_logs: true,
    },
  ],
}
