// Arxiv ro'yxati holati: debounce qilingan qidiruv, kategoriya va "Yana yuklash" sahifalarini birlashtirish
import { useState } from 'react'
import { api, useApi } from '../../api.js'
import { useDebounce } from '../../lib/hooks.js'

export const SEARCH_DEBOUNCE_MS = 300

// Yangi sahifa elementlarini oldingilarga qo'shadi (slug bo'yicha takrorsiz). Keshdagi massiv o'zgartirilmaydi.
function mergeBySlug(prev, next) {
  const seen = new Set(prev.map(a => a.slug))
  const fresh = []
  for (const a of Array.isArray(next) ? next : []) {
    if (typeof a?.slug !== 'string' || !a.slug || seen.has(a.slug)) continue
    seen.add(a.slug)
    fresh.push(a)
  }
  return [...prev, ...fresh]
}

/**
 * @param {string} q — qidiruv maydoni qiymati (debounce shu yerda)
 * @param {string} category
 */
export function useArchive(q, category) {
  const query = useDebounce(q.trim(), SEARCH_DEBOUNCE_MS)
  const filterKey = JSON.stringify([query, category])
  const [paging, setPaging] = useState({ key: filterKey, page: 0 })
  // Filtr/qidiruv o'zgarsa — birinchi sahifadan (render paytidagi holat tuzatish, effektsiz)
  if (paging.key !== filterKey) setPaging({ key: filterKey, page: 0 })
  const page = paging.key === filterKey ? paging.page : 0

  const res = useApi(o => api.archive({ q: query, category, page }, o), [query, category, page])
  const [acc, setAcc] = useState({ key: null, source: null, items: [] })
  if (res.data && acc.source !== res.data) {
    const base = page > 0 && acc.key === filterKey ? acc.items : []
    setAcc({ key: filterKey, source: res.data, items: mergeBySlug(base, res.data.items) })
  }

  const current = acc.key === filterKey ? acc : null
  const last = current?.source ?? null
  const loadMore = () => {
    if (res.loading || !last?.hasMore) return
    setPaging({ key: filterKey, page: page + 1 })
  }
  return {
    query,
    items: current?.items ?? [],
    total: typeof last?.total === 'number' ? last.total : null,
    hasMore: Boolean(last?.hasMore),
    categories: Array.isArray(acc.source?.categories) ? acc.source.categories : [],
    loading: res.loading,
    error: res.error,
    reload: res.reload,
    loadMore,
  }
}
