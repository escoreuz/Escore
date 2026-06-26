import { useState } from 'react'
import { api } from '../api.js'

function initials(name) {
  const p = (name || '').trim().split(/\s+/)
  return (p.length > 1 ? p.slice(0, 2).map((x) => x[0]).join('') : (name || '').slice(0, 3)).toUpperCase()
}

// Logo/rasmli badge. id bo'lsa rasm yuklanadi; xato bo'lsa rangli initsiallarga qaytadi.
// kind: 'team' | 'player' | 'manager' | 'referee' | 'tournament'
export default function Crest({ name, c = '#444', id, kind = 'team', size }) {
  const [err, setErr] = useState(false)
  const cls = `sc-badge${size === 'lg' ? ' sc-badge--lg' : size === 'sm' ? ' sc-badge--sm' : ''}`
  const showImg = id && !err
  return (
    <span className={cls} style={{ background: c, position: 'relative', overflow: 'hidden' }}>
      {initials(name)}
      {showImg && (
        <img
          src={api.img(kind, id)}
          alt=""
          loading="lazy"
          onError={() => setErr(true)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'contain', background: '#fff',
          }}
        />
      )}
    </span>
  )
}
