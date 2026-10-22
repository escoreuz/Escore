// Chegaralangan TTL + LRU kesh (Map qo'shilish tartibi = eskilik tartibi).
// Hajm chegarasi: kalitlar soni (maxEntries) va ixtiyoriy umumiy og'irlik (maxWeight, masalan baytlar).

/**
 * @template V
 * @param {{ maxEntries: number, maxWeight?: number, now?: () => number }} options
 */
export function createTtlCache({ maxEntries, maxWeight = Infinity, now = () => Date.now() }) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new TypeError("maxEntries musbat butun son bo'lishi kerak")
  /** @type {Map<string, { value: V, exp: number, weight: number }>} */
  const map = new Map()
  let totalWeight = 0

  function remove(key) {
    const entry = map.get(key)
    if (!entry) return
    totalWeight -= entry.weight
    map.delete(key)
  }

  function evict() {
    while (map.size > maxEntries || totalWeight > maxWeight) {
      const oldest = map.keys().next()
      if (oldest.done) return
      remove(oldest.value)
    }
  }

  return {
    /** @param {string} key @returns {V | undefined} */
    get(key) {
      const entry = map.get(key)
      if (!entry) return undefined
      if (entry.exp <= now()) {
        remove(key)
        return undefined
      }
      // LRU: oxirgi ishlatilgan — eng oxiriga
      map.delete(key)
      map.set(key, entry)
      return entry.value
    },
    /** @param {string} key @param {V} value @param {number} ttlMs @param {number} [weight] */
    set(key, value, ttlMs, weight = 0) {
      remove(key)
      if (weight > maxWeight) return
      map.set(key, { value, exp: now() + ttlMs, weight })
      totalWeight += weight
      evict()
    },
    /** Muddat va LRU tartibiga tegmasdan qiymatni ko'rish. @param {string} key */
    peek(key) {
      return map.get(key)?.value
    },
    /** Muddatni yangilaydi (masalan, kutilayotgan so'rov tugaganda). */
    touch(key, ttlMs) {
      const entry = map.get(key)
      if (entry) entry.exp = now() + ttlMs
    },
    delete: remove,
    clear() {
      map.clear()
      totalWeight = 0
    },
    get size() {
      return map.size
    },
    get weight() {
      return totalWeight
    },
  }
}
