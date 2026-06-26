import logoUrl from '../assets/logo.svg'

function navigate(hash) {
  window.location.hash = hash
  window.scrollTo(0, 0)
}

export function Loading({ label = 'Yuklanmoqda…' }) {
  return (
    <div className="state state--loading">
      <img className="state__logo" src={logoUrl} alt="eSCORE" />
      <span className="state__label">{label}</span>
    </div>
  )
}

export function ErrorBox({ message, back = '/score' }) {
  return (
    <div className="article article--missing">
      <p className="kicker">XATOLIK</p>
      <h2 className="lead__title">Ma'lumotni yuklab bo'lmadi</h2>
      <p className="state__msg">{message || 'Server bilan aloqa yo\'q. Backend ishga tushganini tekshiring (port 4500).'}</p>
      <a href={`#${back}`} onClick={(e) => { e.preventDefault(); navigate(back) }} className="readmore">← Orqaga</a>
    </div>
  )
}
