// Render xatolarini ushlovchi chegara. React'da funksional ekvivalent yo'q — shuning uchun klass komponent.
import { Component } from 'react'

function reloadPage() {
  window.location.reload()
}

export function ErrorFallback({ onReload = reloadPage }) {
  return (
    <div className="state state--error" role="alert">
      <p className="kicker">XATOLIK</p>
      <h1 className="lead__title">Sahifani ko'rsatib bo'lmadi</h1>
      <p className="state__msg">Kutilmagan xatolik yuz berdi. Sahifani qayta yuklab ko'ring.</p>
      <button type="button" className="state__retry" onClick={onReload}>
        Qayta yuklash
      </button>
    </div>
  )
}

/**
 * @param {{ children: any, resetKey?: string, fallback?: any }} props
 * `resetKey` o'zgarsa (masalan, boshqa sahifaga o'tilganda) xato holati tozalanadi.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) return this.props.fallback ?? <ErrorFallback />
    return this.props.children
  }
}
