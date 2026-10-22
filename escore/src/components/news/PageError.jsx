// Maqola sahifasi holatlari: xato (NOT_FOUND/BAD_REQUEST → 404 noindex, boshqasi → ErrorBox + qayta urinish)
// va yuklanish (noindex sarlavha bilan)
import { useSeo } from '../../lib/seo.js'
import { ErrorBox, Loading } from '../States.jsx'
import NotFound from '../NotFound.jsx'

// Yaroqsiz slug (400) ham foydalanuvchi uchun "sahifa yo'q" degani
const NOT_FOUND_CODES = new Set(['NOT_FOUND', 'BAD_REQUEST'])

/** @param {{ error: { code?: string }, onRetry?: () => void }} props */
export default function PageError({ error, onRetry }) {
  if (NOT_FOUND_CODES.has(error?.code)) return <NotFound />
  return <PageErrorBox error={error} onRetry={onRetry} />
}

function PageErrorBox({ error, onRetry }) {
  useSeo({ title: "Ma'lumotni yuklab bo'lmadi", noindex: true })
  return <ErrorBox error={error} onRetry={onRetry} level={1} />
}

/** Maqola yuklanayotganda: oldingi sahifa sarlavhasi qolib ketmasin */
export function PageLoading({ label = 'Maqola yuklanmoqda…' }) {
  useSeo({ title: 'Yuklanmoqda', noindex: true })
  return <Loading label={label} />
}
