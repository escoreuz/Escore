// Parallellik cheklovchisi: bir vaqtda ko'pi bilan `concurrency` ta vazifa,
// navbat chegaralangan (`maxQueue`) va navbatda kutish vaqti cheklangan (`maxWaitMs`).
// To'lsa yoki kutish oshsa — darhol UpstreamError 503 (backpressure).

import { UpstreamError } from '../errors.js'

const OVERLOAD_STATUS = 503

/**
 * @param {{ concurrency: number, maxQueue: number, maxWaitMs?: number, name?: string }} options
 * @returns {<T>(task: () => Promise<T>) => Promise<T>}
 */
export function createLimiter({ concurrency, maxQueue, maxWaitMs = Infinity, name = 'score-api' }) {
  let active = 0
  /** @type {Array<{ start: () => void }>} */
  const queue = []

  function next() {
    active--
    const item = queue.shift()
    if (item) item.start()
  }

  function enqueue(task) {
    return new Promise((resolve, reject) => {
      let timer = null
      const item = {
        start() {
          if (timer) clearTimeout(timer)
          active++
          Promise.resolve().then(task).then(resolve, reject).finally(next)
        },
      }
      if (Number.isFinite(maxWaitMs)) {
        timer = setTimeout(() => {
          const i = queue.indexOf(item)
          if (i >= 0) queue.splice(i, 1)
          reject(new UpstreamError(`${name} navbatida kutish ${maxWaitMs} ms dan oshdi`, { status: OVERLOAD_STATUS }))
        }, maxWaitMs)
      }
      queue.push(item)
    })
  }

  return function run(task) {
    if (active < concurrency) {
      active++
      return Promise.resolve().then(task).finally(next)
    }
    if (queue.length >= maxQueue) {
      return Promise.reject(new UpstreamError(`${name} navbati to'lgan`, { status: OVERLOAD_STATUS }))
    }
    return enqueue(task)
  }
}

/**
 * Elementlarni ko'pi bilan `limit` ta parallel ishlov beradi; natija allSettled shaklida.
 * @template I, O
 * @param {I[]} items
 * @param {number} limit
 * @param {(item: I) => Promise<O>} fn
 * @returns {Promise<PromiseSettledResult<O>[]>}
 */
export async function mapSettledLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]) }
      } catch (reason) {
        results[i] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
