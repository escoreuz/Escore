// Sana tasmasi (serverdagi `api.days()` — bugun ± N, Asia/Tashkent).
const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
]
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 'YYYY-MM-DD' → "15-oktabr 2026"; noto'g'ri satr bo'lsa o'zi. */
export function fullDateLabel(date) {
  const match = typeof date === 'string' ? date.match(DATE_RE) : null
  if (!match) return String(date ?? '')
  const month = MONTHS[Number(match[2]) - 1]
  return month ? `${Number(match[3])}-${month} ${match[1]}` : date
}

/**
 * @param {{ days: { date: string, dow: string, d: string, label: string }[], today: string|null,
 *   selected: string|null, onPick: (date: string) => void }} props
 */
export default function DayStrip({ days, today, selected, onPick }) {
  return (
    <div className="sc-days" role="group" aria-label="Sana tanlash">
      {days.map(day => {
        const isToday = day.date === today
        const label = `${isToday ? 'Bugun' : day.label}, ${fullDateLabel(day.date)}`
        return (
          <button
            key={day.date}
            type="button"
            className={`sc-day${selected === day.date ? ' is-sel' : ''}`}
            aria-pressed={selected === day.date}
            aria-current={isToday ? 'date' : undefined}
            aria-label={label}
            onClick={() => onPick(day.date)}
          >
            <span className="sc-day__dow">{day.dow}</span>
            <span className="sc-day__d">{day.d}</span>
            <span className="sc-day__label">{isToday ? 'Bugun' : day.label}</span>
          </button>
        )
      })}
    </div>
  )
}
