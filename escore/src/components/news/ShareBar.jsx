// Ulashish paneli: Telegram, Facebook va havolani nusxalash (natija role="status" bilan e'lon qilinadi)
import { useEffect, useState } from 'react'

export const telegramShareUrl = (url, title) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title || '')}`
export const facebookShareUrl = url => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`

export const COPY_OK = 'Havola nusxalandi'
export const COPY_FAIL = "Nusxalab bo'lmadi — havolani manzil satridan nusxalang"
// Holat xabari shu vaqtdan keyin tozalanadi (eskirgan "nusxalandi" qolib ketmasin)
export const STATUS_CLEAR_MS = 4000

async function copyText(text) {
  if (!navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // Ruxsat berilmagan / xavfsiz bo'lmagan kontekst — foydalanuvchiga aniq holat ko'rsatiladi
    console.warn('[share] clipboard', err)
    return false
  }
}

/** @param {{ url: string, title: string }} props */
export default function ShareBar({ url, title }) {
  const [status, setStatus] = useState('')
  useEffect(() => {
    if (!status) return undefined
    const id = setTimeout(() => setStatus(''), STATUS_CLEAR_MS)
    return () => clearTimeout(id)
  }, [status])
  const copy = async () => setStatus((await copyText(url)) ? COPY_OK : COPY_FAIL)
  return (
    <div className="share-bar" role="group" aria-label="Ulashish">
      <span className="share-bar__label" aria-hidden="true">
        ULASHISH:
      </span>
      <a
        className="share-bar__btn"
        href={telegramShareUrl(url, title)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Telegram orqali ulashish (yangi oynada)"
      >
        Telegram
      </a>
      <a
        className="share-bar__btn"
        href={facebookShareUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Facebook orqali ulashish (yangi oynada)"
      >
        Facebook
      </a>
      <button type="button" className="share-bar__btn" onClick={copy} data-copied={status === COPY_OK}>
        Havolani nusxalash
      </button>
      <span className="share-bar__label" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  )
}
