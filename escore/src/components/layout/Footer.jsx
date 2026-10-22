// Sayt pastki qismi. Sarlavhalar h2 (sahifa h1 dan keyin to'g'ri ierarxiya).
import logoUrl from '../../assets/logo.svg'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="foot">
      <div className="foot__rule" />
      <div className="foot__grid">
        <div>
          <p className="logo logo--sm foot__brand">
            <img src={logoUrl} alt="" className="foot__logo" width="32" height="32" />e
            <span className="logo__score">SCORE</span>
          </p>
          <p>Futbol gazetasi. Maydondagi har bir lahza — tarix.</p>
        </div>
        <div>
          <h2 className="foot__heading">Bo'limlar</h2>
          <p>Chempionlar Ligasi · Premier-liga · Transferlar · Milliy terma · Tahlil</p>
        </div>
        <div>
          <h2 className="foot__heading">Tahririyat</h2>
          <p>Toshkent sh. · tahririyat@escore.uz</p>
        </div>
      </div>
      <p className="foot__copy">© {year} eSCORE. Barcha huquqlar himoyalangan.</p>
    </footer>
  )
}
