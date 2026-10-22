// Maqola havolasi — har doim o'z saytimizda ochiladi.
// Real yangilik: a.href (/news/<slug>); saytning o'z maqolasi: /article/<slug>.
import { Link, isInternalPath } from '../../lib/nav.jsx'

/**
 * @param {{ href?: string, slug?: string }} a
 * @returns {string}
 */
export function storyPath(a) {
  if (isInternalPath(a?.href)) return a.href
  if (a?.slug) return `/article/${encodeURIComponent(a.slug)}`
  return '/'
}

/** Rasm-havola takrori uchun: klaviatura va ekran o'quvchidan yashiriladi (sarlavha havolasi bor). */
export const DUPLICATE_LINK_PROPS = { tabIndex: -1, 'aria-hidden': 'true' }

export default function StoryLink({ a, className, children, ...rest }) {
  return (
    <Link to={storyPath(a)} className={className} {...rest}>
      {children}
    </Link>
  )
}
