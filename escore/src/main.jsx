import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { migrateLegacyHash } from './lib/nav.jsx'
import './styles.css'

// Eski `#/...` havolalar (ulashilgan linklar) birinchi renderdan oldin yangi yo'lga ko'chiriladi
migrateLegacyHash()

// Ildiz chegarasi: Masthead/Nav/Footer xatosi ham oq ekran emas, fallback beradi
// (sahifa darajasidagi xatolarni App ichidagi chegara ushlaydi)
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
