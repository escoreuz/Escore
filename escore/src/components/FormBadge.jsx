// Jamoa formasi belgisi (G/D/M): ko'rinadigan harf + ekran o'quvchi uchun to'liq so'z.
// League va Team sahifalarida umumiy.

const FORM = {
  G: { cls: 'is-w', word: "G'alaba" },
  D: { cls: 'is-d', word: 'Durang' },
  M: { cls: 'is-l', word: "Mag'lubiyat" },
}

/** Natija harfi tanilganmi (G/D/M). */
export const isFormResult = r => typeof r === 'string' && Object.hasOwn(FORM, r)

/** @param {{ r: 'G'|'D'|'M' }} props — noma'lum harf bo'lsa hech narsa chizilmaydi */
export default function FormBadge({ r }) {
  if (!isFormResult(r)) return null
  const { cls, word } = FORM[r]
  return (
    <span className={`lg-form ${cls}`}>
      <span aria-hidden="true">{r}</span>
      <span className="sr-only">{word}</span>
    </span>
  )
}

/**
 * Natijalar qatori. Bo'sh yoki noma'lum bo'lsa "—".
 * @param {{ form?: string[] }} props
 */
export function FormList({ form }) {
  const list = Array.isArray(form) ? form.filter(isFormResult) : []
  if (!list.length) return <span className="lg-forms">—</span>
  return (
    <span className="lg-forms">
      {list.map((f, i) => (
        <FormBadge key={i} r={f} />
      ))}
    </span>
  )
}
