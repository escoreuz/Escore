// eSCORE backend — kirish nuqtasi: adapterni tanlash, listen va graceful shutdown.
// Butun HTTP mantiq app.js (createApp) da. USE_REAL=0 — DEMO rejim, aks holda REAL (default).
import { createApp } from './app.js'
import * as store from './store.js'
import * as archive from './archive.js'

const DEFAULT_PORT = 4500
const SHUTDOWN_TIMEOUT_MS = 10 * 1000
const REQUEST_TIMEOUT_MS = 30 * 1000
const HEADERS_TIMEOUT_MS = 20 * 1000
const KEEP_ALIVE_TIMEOUT_MS = 65 * 1000 // proksi (Render) idle timeoutidan katta
const MAX_CONNECTIONS = 1000

const logger = console
const mode = process.env.USE_REAL === '0' ? 'demo' : 'real'
const port = Number.parseInt(process.env.PORT ?? '', 10) || DEFAULT_PORT

// Demo adapter faqat demo rejimda yuklanadi — real rejimda demo kod umuman ishlamaydi
async function loadSofa() {
  if (mode === 'real') return import('./sofascore.js')
  const { createDemoAdapter } = await import('./demo/adapter.js')
  const adapter = createDemoAdapter()
  adapter.start()
  return adapter
}

const sofa = await loadSofa()
const app = createApp({ sofa, store, archive, mode, logger })
const server = app.listen(port, () => logger.info(`eSCORE API (${mode}) → http://localhost:${port}`))
server.requestTimeout = REQUEST_TIMEOUT_MS
server.headersTimeout = HEADERS_TIMEOUT_MS
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS
server.maxConnections = MAX_CONNECTIONS

let shuttingDown = false
async function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info(`[shutdown] ${reason}: yangi ulanishlar qabul qilinmaydi`)
  const force = setTimeout(() => {
    logger.error('[shutdown] vaqt tugadi — majburan chiqilmoqda')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  force.unref()
  sofa.stop?.()
  await new Promise(resolve =>
    server.close(err => {
      if (err) logger.error('[shutdown] server.close xatosi', err)
      resolve()
    }),
  )
  try {
    await archive.flush()
  } catch (err) {
    logger.error('[shutdown] archive.flush xatosi', err)
    exitCode = 1
  }
  process.exit(exitCode)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', reason => logger.error('[unhandledRejection]', reason))
process.on('uncaughtException', err => {
  logger.error('[uncaughtException]', err)
  shutdown('uncaughtException', 1)
})
