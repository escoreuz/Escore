// Sayt bo'yicha qidiruv formasi → /search/:q
import { useState } from 'react'
import { navigate } from '../../lib/nav.jsx'

// Server `q` uchun 80 belgidan uzun so'rovni rad etadi (FIX-PLAN 2.3)
export const MAX_QUERY_LENGTH = 80

export default function SearchBox() {
  const [q, setQ] = useState('')
  const handleSubmit = e => {
    e.preventDefault()
    const term = q.trim().slice(0, MAX_QUERY_LENGTH)
    if (term) navigate(`/search/${encodeURIComponent(term)}`)
  }
  return (
    <form className="search" onSubmit={handleSubmit} role="search">
      <input
        className="search__input"
        type="search"
        value={q}
        maxLength={MAX_QUERY_LENGTH}
        onChange={e => setQ(e.target.value)}
        placeholder="Qidirish…"
        aria-label="Saytdan qidirish"
      />
      <button className="search__btn" type="submit" aria-label="Qidirish">
        <span aria-hidden="true">⌕</span>
      </button>
    </form>
  )
}
