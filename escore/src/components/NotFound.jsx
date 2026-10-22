// 404 sahifasi: noma'lum yo'l. Qidiruv tizimlari indekslamaydi (noindex).
import { Link } from '../lib/nav.jsx'
import { useSeo } from '../lib/seo.js'

export default function NotFound() {
  useSeo({ title: 'Sahifa topilmadi', noindex: true })
  return (
    <section className="not-found">
      <p className="kicker">404</p>
      <h1 className="lead__title">Sahifa topilmadi</h1>
      <p className="state__msg">Siz qidirgan sahifa mavjud emas yoki boshqa manzilga ko'chirilgan.</p>
      <p>
        <Link to="/" className="readmore">
          ← Bosh sahifaga qaytish
        </Link>
      </p>
    </section>
  )
}
