import { createServer } from 'node:net'

/**
 * 在指定 host 上寻找可用端口
 * port = 0 时由 OS 分配随机端口
 */
export function findFreePort(host = '127.0.0.1', port = 0): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(port, host, () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        server.close()
        reject(new Error('Failed to determine assigned port'))
        return
      }
      const assignedPort = addr.port
      server.close(() => resolve(assignedPort))
    })
    server.on('error', reject)
  })
}
