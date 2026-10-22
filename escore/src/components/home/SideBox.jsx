// Yon panel qutisi: sarlavha + tarkib; manba ishlamasa ".unavailable" yozuvi, bo'sh bo'lsa yashiriladi.
import { useId } from 'react'

export const UNAVAILABLE_TEXT = "Ma'lumot manbai vaqtincha ishlamayapti"

/**
 * @param {{ title: string, unavailable?: boolean, empty?: boolean, className?: string, children?: any }} props
 */
export default function SideBox({ title, unavailable = false, empty = false, className = 'box', children }) {
  const titleId = useId()
  if (empty && !unavailable) return null
  return (
    <section className={className} aria-labelledby={titleId}>
      <h2 className="box__title" id={titleId}>
        {title}
      </h2>
      {unavailable ? <p className="unavailable">{UNAVAILABLE_TEXT}</p> : children}
    </section>
  )
}
