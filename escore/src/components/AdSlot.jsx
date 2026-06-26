// Reklama joyi (placeholder). Keyinchalik banner rasm/HTML bilan to'ldiriladi.
// Foydalanish: <AdSlot /> yoki <AdSlot href="..." img="/banner.jpg" alt="..." />
export default function AdSlot({ label = 'Reklama', img, href, alt = '', height = 300 }) {
  if (img) {
    const banner = <img className="ad-slot__img" src={img} alt={alt} loading="lazy" />
    return (
      <div className="ad-slot ad-slot--filled" style={{ minHeight: height }}>
        {href
          ? <a href={href} target="_blank" rel="noopener noreferrer sponsored">{banner}</a>
          : banner}
      </div>
    )
  }
  return (
    <div className="ad-slot" style={{ minHeight: height }}>
      <span className="ad-slot__tag">{label.toUpperCase()}</span>
      <span className="ad-slot__hint">Banner joyi</span>
    </div>
  )
}
