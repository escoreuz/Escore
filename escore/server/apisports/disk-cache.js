// API-Football javoblari uchun xotira + disk kesh (server qayta ishga tushsa kvota yonmasin).
// - LRU (Map tartibi), kalitlar soni va umumiy hajm (bayt) chegaralangan.
// - Muddati o'tgan yozuv darhol o'chirilmaydi: kvota tugaganda "eskirgan" (stale) javob sifatida beriladi;
//   STALE_KEEP_MS dan eski yozuvlar yuklashda tashlanadi.
// - Diskka yozish atomik (tmp + rename), kechiktirilgan (debounce); xato log qilinadi, server yiqilmaydi.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const FORMAT_VERSION = 1
const DEFAULT_MAX_ENTRIES = 1500
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024
const DEFAULT_FLUSH_DELAY_MS = 2000
const STALE_KEEP_MS = 7 * 24 * 60 * 60 * 1000

const sizeOf = (key, value) => JSON.stringify(value ?? null).length + key.length

/** Fayldan o'qish: { meta, entries: [[key, {v, exp, at}]] } yoki bo'sh (xato log qilinadi). */
function readSnapshot(file, logger) {
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch (err) {
    if (err.code !== 'ENOENT') logger.warn(`[apisports] kesh faylini o'qib bo'lmadi: ${err.message}`)
    return { meta: {}, entries: [] }
  }
  try {
    const data = JSON.parse(raw)
    if (data?.version !== FORMAT_VERSION || typeof data.entries !== 'object') throw new Error('format mos emas')
    return { meta: data.meta && typeof data.meta === 'object' ? data.meta : {}, entries: Object.entries(data.entries) }
  } catch (err) {
    logger.warn(`[apisports] kesh fayli buzilgan, bo'sh kesh bilan boshlanadi: ${err.message}`)
    return { meta: {}, entries: [] }
  }
}

/** Atomik yozish (tmp + rename). */
function writeAtomic(file, body, logger) {
  const tmp = `${file}.${process.pid}.tmp`
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(tmp, body)
    renameSync(tmp, file)
  } catch (err) {
    logger.warn(`[apisports] kesh faylini yozib bo'lmadi: ${err.message}`)
  }
}

export class DiskCache {
  /**
   * @param {{ file?: string | null, maxEntries?: number, maxBytes?: number, flushDelayMs?: number,
   *   now?: () => number, logger?: Pick<Console, 'warn'> }} [options]  file=null — faqat xotira
   */
  constructor({
    file = null,
    maxEntries = DEFAULT_MAX_ENTRIES,
    maxBytes = DEFAULT_MAX_BYTES,
    flushDelayMs = DEFAULT_FLUSH_DELAY_MS,
    now = Date.now,
    logger = console,
  } = {}) {
    Object.assign(this, { file, maxEntries, maxBytes, flushDelayMs, now, logger })
    this.map = new Map()
    this.totalBytes = 0
    this.meta = {}
    this.timer = null
    if (file) this.load()
  }

  load() {
    const snap = readSnapshot(this.file, this.logger)
    this.meta = snap.meta
    const cutoff = this.now() - STALE_KEEP_MS
    for (const [key, e] of snap.entries) {
      if (Number.isFinite(e?.exp) && e.exp >= cutoff) this.put(key, { v: e.v, exp: e.exp, at: e.at })
    }
  }

  put(key, entry) {
    this.remove(key)
    const size = sizeOf(key, entry.v)
    if (size > this.maxBytes) return
    this.map.set(key, { ...entry, size })
    this.totalBytes += size
    while (this.map.size > this.maxEntries || this.totalBytes > this.maxBytes) this.remove(this.map.keys().next().value)
  }

  remove(key) {
    const e = this.map.get(key)
    if (!e) return
    this.totalBytes -= e.size
    this.map.delete(key)
  }

  /** Yozuv (muddati o'tgan bo'lsa ham) yoki undefined. `fresh` — muddati o'tmagan. */
  get(key) {
    const e = this.map.get(key)
    if (!e) return undefined
    this.map.delete(key)
    this.map.set(key, e) // LRU
    return { value: e.v, fresh: e.exp > this.now(), at: e.at }
  }

  set(key, value, ttlMs) {
    const at = this.now()
    this.put(key, { v: value, exp: at + ttlMs, at })
    this.scheduleFlush()
  }

  /** Kichik holat (masalan kunlik byudjet) — kesh bilan birga diskda saqlanadi. */
  getMeta(name) {
    return this.meta[name]
  }

  setMeta(name, value) {
    this.meta = { ...this.meta, [name]: value }
    this.scheduleFlush()
  }

  scheduleFlush() {
    if (!this.file || this.timer) return
    this.timer = setTimeout(() => this.flush(), this.flushDelayMs)
    this.timer.unref?.()
  }

  flush() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (!this.file) return
    const entries = Object.fromEntries([...this.map].map(([k, e]) => [k, { v: e.v, exp: e.exp, at: e.at }]))
    writeAtomic(this.file, JSON.stringify({ version: FORMAT_VERSION, meta: this.meta, entries }), this.logger)
  }

  get size() {
    return this.map.size
  }
}

export const createDiskCache = options => new DiskCache(options)
