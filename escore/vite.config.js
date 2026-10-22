import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// index.html dagi __SITE_URL__ → VITE_SITE_URL (oxirgi / siz). Ijtimoiy tarmoq skrapperlari
// (Telegram, Facebook) JS bajarmaydi va OG uchun mutlaq URL kutadi. O'zgaruvchi yo'q yoki
// yaroqsiz bo'lsa bo'sh satr qo'yiladi — yo'llar nisbiy qoladi.
function siteUrlHtml(mode) {
  const site = (loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL || '').trim().replace(/\/+$/, '')
  const safe = /^https?:\/\/[^\s"'<>]+$/i.test(site) ? site : ''
  return { name: 'escore-site-url', transformIndexHtml: html => html.replaceAll('__SITE_URL__', safe) }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), siteUrlHtml(mode)],
  server: { port: 5190 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // Har fayl birinchi testida jsdom + modul sovuq importi parallel yuklamada 5 s dan oshadi
    // (ketma-ket rejimda 328/328 o'tadi) — chegara muhit uchun, test mantig'i uchun emas.
    testTimeout: 15_000,
  },
}))
