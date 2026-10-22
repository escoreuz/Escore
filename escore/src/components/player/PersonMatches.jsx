// Murabbiy/hakam sahifasidagi so'nggi o'yinlar ro'yxati (umumiy MatchRow qatorlari).
import MatchRow from '../MatchRow.jsx'
import Unavailable from './Unavailable.jsx'

/**
 * @param {{ matches?: object[], unavailable?: boolean, emptyText: string }} props
 */
export default function PersonMatches({ matches, unavailable = false, emptyText }) {
  if (unavailable) return <Unavailable>O'yinlar ro'yxati yuklanmadi — manba javob bermadi.</Unavailable>
  // ID'siz o'yinga havola qurib bo'lmaydi — bunday qatorlar ko'rsatilmaydi
  const list = Array.isArray(matches) ? matches.filter(m => m && m.id != null && m.home && m.away) : []
  if (!list.length) return <p className="mp-empty">{emptyText}</p>
  return (
    <div className="lg-matches">
      {list.map(m => (
        <MatchRow key={m.id} match={m} />
      ))}
    </div>
  )
}
