// Holat filtri (aria-pressed tugmalar guruhi) va jamoa qidiruvi.
export const STATUS_FILTERS = [
  { id: 'all', label: 'Hammasi' },
  { id: 'live', label: 'Jonli' },
  { id: 'ft', label: 'Tugagan' },
  { id: 'sched', label: 'Rejada' },
]

/**
 * @param {{ status: string, onStatus: (id: string) => void, liveCount: number,
 *   query: string, onQuery: (q: string) => void }} props
 */
export default function Toolbar({ status, onStatus, liveCount, query, onQuery }) {
  return (
    <div className="sc-toolbar">
      <div className="sc-tabs" role="group" aria-label="O'yin holati bo'yicha filtr">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            className={`sc-tab${status === f.id ? ' is-sel' : ''}`}
            aria-pressed={status === f.id}
            onClick={() => onStatus(f.id)}
          >
            {f.label}
            {f.id === 'live' && liveCount > 0 && (
              <span className="sc-tab__badge">
                <span className="sr-only"> (</span>
                {liveCount}
                <span className="sr-only"> ta)</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="sc-toolbar__right">
        <input
          className="sc-search"
          type="search"
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Jamoa qidirish…"
          aria-label="Jamoa qidirish"
        />
      </div>
    </div>
  )
}
