// Sozlamalar (mavzu, vaqt mintaqasi) — disclosure naqshi (menu EMAS).
// Escape yopadi va fokusni tugmaga qaytaradi; fokus yoki bosish tashqariga chiqsa yopiladi.
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { getSettings, setSettings, subscribeSettings, TIMEZONES } from '../../settings.js'

const THEMES = [
  { id: 'light', icon: '☀', label: "Yorug'" },
  { id: 'dark', icon: '☾', label: 'Tungi' },
]

function ThemeButtons({ theme, labelId }) {
  return (
    <div className="settings__themes" role="group" aria-labelledby={labelId}>
      {THEMES.map(t => (
        <button
          key={t.id}
          type="button"
          className={`settings__theme${theme === t.id ? ' is-sel' : ''}`}
          aria-pressed={theme === t.id}
          onClick={() => setSettings({ theme: t.id })}
        >
          <span aria-hidden="true">{t.icon}</span> {t.label}
        </button>
      ))}
    </div>
  )
}

// Ochiq panel tashqarisiga bosilganda yopish
function useOutsidePointer(open, rootRef, onOutside) {
  useEffect(() => {
    if (!open) return undefined
    const handlePointer = e => {
      if (!rootRef.current?.contains(e.target)) onOutside()
    }
    document.addEventListener('pointerdown', handlePointer)
    return () => document.removeEventListener('pointerdown', handlePointer)
  }, [open, rootRef, onOutside])
}

export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const settings = useSyncExternalStore(subscribeSettings, getSettings)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const baseId = useId()
  const panelId = `${baseId}-panel`
  const themeLabelId = `${baseId}-theme`
  const tzId = `${baseId}-tz`

  useOutsidePointer(open, rootRef, () => setOpen(false))

  const handleKeyDown = e => {
    if (e.key !== 'Escape' || !open) return
    e.stopPropagation()
    setOpen(false)
    buttonRef.current?.focus()
  }
  const handleBlur = e => {
    if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget)) setOpen(false)
  }

  return (
    <div className="settings" ref={rootRef} onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        className="settings__btn"
        onClick={() => setOpen(o => !o)}
        aria-label="Sozlamalar"
        title="Sozlamalar"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span aria-hidden="true">⚙</span>
      </button>
      {open && <SettingsPanel id={panelId} settings={settings} themeLabelId={themeLabelId} tzId={tzId} />}
    </div>
  )
}

function SettingsPanel({ id, settings, themeLabelId, tzId }) {
  return (
    <div className="settings__panel" id={id}>
      <div className="settings__group">
        <span className="settings__label" id={themeLabelId}>
          Ko'rinish
        </span>
        <ThemeButtons theme={settings.theme} labelId={themeLabelId} />
      </div>
      <div className="settings__group">
        <label className="settings__label" htmlFor={tzId}>
          Vaqt mintaqasi (soat)
        </label>
        <select
          id={tzId}
          className="settings__select"
          value={settings.tz}
          onChange={e => setSettings({ tz: e.target.value })}
        >
          {TIMEZONES.map(z => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
