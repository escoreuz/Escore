// O'yinchi / murabbiy / hakam sahifalarining umumiy sarlavha bloki (`pl-hero`).
// Sahifadagi yagona <h1> shu yerda.
import { useState } from 'react'
import { api } from '../api.js'
import { readableTextColor } from '../lib/color.js'
import { initials } from '../lib/format.js'
import { Link } from '../lib/nav.jsx'
import Crest from './Crest.jsx'

const PHOTO_STYLE = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}
// Hero rasmi sahifaning yuqori qismida (LCP) — lazy emas, yuqori ustuvorlik; o'lcham .pl-hero__av ga mos
const PHOTO_PX = 112
const AVATAR_STYLE = { position: 'relative', overflow: 'hidden' }

/** Initsiallar + rasm (bo'lsa). Rasm yuklanmasa initsiallar qoladi. */
function PersonAvatar({ name, color, photoKind, photoId }) {
  const [failed, setFailed] = useState(false)
  const src = photoId != null ? api.img(photoKind, photoId) : null
  return (
    <span
      className="pl-hero__av"
      style={{ ...AVATAR_STYLE, background: color, color: readableTextColor(color) ?? undefined }}
    >
      <span aria-hidden="true">{initials(name)}</span>
      {src && !failed && (
        <img
          src={src}
          alt={`${name} surati`}
          width={PHOTO_PX}
          height={PHOTO_PX}
          fetchpriority="high"
          decoding="async"
          onError={() => setFailed(true)}
          style={PHOTO_STYLE}
        />
      )}
    </span>
  )
}

/** Jamoa qatori: ID bo'lsa jamoa sahifasiga havola. */
function HeroTeam({ name, id, color }) {
  const crest = <Crest name={name} c={color} id={id} kind="team" size="sm" />
  return (
    <p className="pl-hero__team">
      {id != null ? (
        <Link to={`/team/${encodeURIComponent(id)}`} className="pl-hero__teamlink">
          {crest} {name}
        </Link>
      ) : (
        <span>
          {crest} {name}
        </span>
      )}
    </p>
  )
}

/**
 * @param {{ name: string, kicker?: any, avatar?: any, color?: string, photoKind?: string, photoId?: any,
 *   team?: { name: string, id?: any, color?: string }, subline?: any, aside?: any,
 *   stat?: { value: any, cap: string }, children?: any }} props
 * `avatar` — tayyor element (masalan hakam belgisi); berilmasa initsiallar + rasm.
 * `aside` — ism yonidagi qo'shimcha (obunachilar); `stat` — o'ngdagi katta ko'rsatkich (null → "—").
 */
export default function PersonHero({
  name,
  kicker,
  avatar,
  color,
  photoKind,
  photoId,
  team,
  subline,
  aside,
  stat,
  children,
}) {
  const title = <h1 className="pl-hero__name">{name}</h1>
  return (
    <header className="pl-hero">
      {avatar ?? <PersonAvatar name={name} color={color} photoKind={photoKind} photoId={photoId} />}
      <div className="pl-hero__info">
        {kicker && <p className="kicker">{kicker}</p>}
        {aside ? (
          <div className="pl-hero__top">
            {title}
            {aside}
          </div>
        ) : (
          title
        )}
        {team && <HeroTeam {...team} />}
        {subline && <p className="pl-hero__team">{subline}</p>}
        {children}
      </div>
      {stat && (
        <div className="pl-hero__rating">
          <span className="pl-hero__num">{stat.value ?? '—'}</span>
          <span className="pl-hero__cap">{stat.cap}</span>
        </div>
      )}
    </header>
  )
}
