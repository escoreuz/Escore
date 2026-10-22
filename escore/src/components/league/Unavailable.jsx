// Bo'lim ma'lumoti yuklanmagan bo'lsa (server meta.unavailable) ko'rsatiladigan yozuv.
import { UNAVAILABLE_TEXT, isUnavailable } from './shared.js'

/**
 * @param {{ meta?: { unavailable?: string[] }, parts: string[], label?: string }} props
 */
export default function Unavailable({ meta, parts, label }) {
  if (!isUnavailable(meta, parts)) return null
  return (
    <p className="unavailable" role="note">
      {label ? `${label}: ` : ''}
      {UNAVAILABLE_TEXT}
    </p>
  )
}
