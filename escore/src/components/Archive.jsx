// Maqolalar arxivi: qidiruv, kategoriya filtri va "Yana yuklash" bilan sahifalash
import { useEffect, useRef, useState } from 'react'
import { Link } from '../lib/nav.jsx'
import { useSeo } from '../lib/seo.js'
import { Empty, ErrorBox, Loading } from './States.jsx'
import NewsCard from './news/NewsCard.jsx'
import { useArchive } from './news/useArchive.js'

const EMPTY_ARCHIVE = "Arxiv hozircha bo'sh — yangiliklarni ochsangiz, ular shu yerga saqlanadi."
const QUERY_MAX_LENGTH = 80

function statusText({ total, items, loading }) {
  if (total === null) return loading ? 'Arxiv yuklanmoqda' : ''
  return `${total} ta maqola topildi, ${items.length} tasi ko'rsatilmoqda`
}

function CategoryFilter({ categories, value, onChange }) {
  const button = (name, label, count) => (
    <button
      key={name || '__all'}
      type="button"
      className={`arch-cat${value === name ? ' is-sel' : ''}`}
      aria-pressed={value === name}
      onClick={() => onChange(name)}
    >
      {label} {count != null && <span className="arch-cat__n">{count}</span>}
    </button>
  )
  return (
    <div className="arch-cats" role="group" aria-label="Kategoriya bo'yicha filtr">
      {button('', 'Hammasi')}
      {categories.map(c => button(c.name, c.name, c.count))}
    </div>
  )
}

function EmptyResult({ query, category }) {
  if (!query && !category) return <Empty>{EMPTY_ARCHIVE}</Empty>
  return <Empty>{query ? `“${query}” bo'yicha maqola topilmadi.` : 'Bu kategoriyada maqola topilmadi.'}</Empty>
}

/**
 * "Yana yuklash": tugma yuklanish paytida fokusni yo'qotmasligi uchun `aria-disabled` (disabled emas);
 * yangi sahifa kelgach fokus birinchi yangi kartochka sarlavhasiga o'tadi.
 */
function useLoadMoreFocus(items, loadMore) {
  const gridRef = useRef(null)
  const pendingIndex = useRef(null)
  useEffect(() => {
    const idx = pendingIndex.current
    if (idx === null || items.length <= idx) return
    pendingIndex.current = null
    gridRef.current?.querySelectorAll('.nw-card__title')[idx]?.focus()
  }, [items.length])
  const onLoadMore = () => {
    pendingIndex.current = items.length
    loadMore()
  }
  return { gridRef, onLoadMore }
}

function Results({ arch, category }) {
  const { items, error, loading, hasMore, reload, loadMore } = arch
  const { gridRef, onLoadMore } = useLoadMoreFocus(items, loadMore)
  if (items.length === 0) {
    if (error) return <ErrorBox error={error} onRetry={reload} />
    if (loading) return <Loading label="Arxiv yuklanmoqda…" />
    return <EmptyResult query={arch.query} category={category} />
  }
  return (
    <>
      <div className="nw-grid" ref={gridRef}>
        {items.map(a => (
          <NewsCard key={a.slug} item={a} meta={[a.hasFull ? 'To‘liq maqola' : 'Qisqacha', a.time]} />
        ))}
      </div>
      {error && <ErrorBox error={error} onRetry={reload} title="Keyingi sahifani yuklab bo'lmadi" />}
      {hasMore && !error && (
        <button type="button" className="arch-more" onClick={onLoadMore} aria-disabled={loading} aria-busy={loading}>
          {loading ? 'Yuklanmoqda…' : 'Yana yuklash'}
        </button>
      )}
    </>
  )
}

export default function Archive() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const arch = useArchive(q, category)
  useSeo({
    title: 'Maqolalar arxivi',
    description: "eSCORE arxivi: saytda e'lon qilingan futbol maqolalari — sarlavha yoki matn bo'yicha qidiring.",
    path: '/archive',
  })

  return (
    <section className="nw arch">
      <header className="nw-head">
        <Link to="/news" className="article__back">
          ← Yangiliklar
        </Link>
        <p className="kicker">ARXIV · QIDIRUV</p>
        <h1 className="score__title">Maqolalar arxivi</h1>
        <p className="score__standfirst">
          Saytda ko'rilgan barcha maqolalar shu yerda saqlanadi — sarlavha yoki matn bo'yicha qidiring
          {arch.total !== null ? ` (${arch.total} ta maqola)` : ''}.
        </p>
      </header>

      <div className="arch-tools">
        <input
          className="sc-search arch-search"
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Maqola qidirish (sarlavha yoki matn)…"
          aria-label="Arxivdan qidirish"
          maxLength={QUERY_MAX_LENGTH}
        />
        <CategoryFilter categories={arch.categories} value={category} onChange={setCategory} />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {statusText(arch)}
      </p>
      <Results arch={arch} category={category} />
    </section>
  )
}
