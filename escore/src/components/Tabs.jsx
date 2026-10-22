// WAI-ARIA tab naqshi: role=tablist/tab/tabpanel, ←/→/Home/End, roving tabindex
import { useRef } from 'react'

export const tabId = (idBase, id) => `${idBase}-tab-${id}`
export const panelId = (idBase, id) => `${idBase}-panel-${id}`

// Bosilgan tugmaga ko'ra yangi indeks; tegishli bo'lmagan tugma → null
function nextIndex(key, current, count) {
  if (key === 'ArrowRight') return (current + 1) % count
  if (key === 'ArrowLeft') return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/**
 * @param {{ tabs: { id: string, label: any }[], value: string, onChange: (id: string) => void,
 *   idBase: string, label: string, className?: string, tabClassName?: string }} props
 */
export function Tabs({ tabs, value, onChange, idBase, label, className = 'mp-tabs', tabClassName = 'mp-tab' }) {
  const refs = useRef([])
  const selectedIndex = Math.max(
    0,
    tabs.findIndex(t => t.id === value),
  )

  const handleKeyDown = e => {
    // Alt+← (orqaga) kabi brauzer/OS yorliqlarini buzmaslik uchun modifikatorli bosishlar e'tiborsiz
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const next = nextIndex(e.key, selectedIndex, tabs.length)
    if (next === null) return
    e.preventDefault()
    onChange(tabs[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className={className} onKeyDown={handleKeyDown}>
      {tabs.map((t, i) => {
        const selected = i === selectedIndex
        return (
          <button
            key={t.id}
            ref={el => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={tabId(idBase, t.id)}
            aria-selected={selected}
            aria-controls={panelId(idBase, t.id)}
            tabIndex={selected ? 0 : -1}
            className={`${tabClassName}${selected ? ' is-sel' : ''}`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Faqat tanlangan panel tarkibi render qilinadi; qolganlari bo'sh `hidden` element (aria-controls uchun).
 * @param {{ idBase: string, id: string, value: string, className?: string, children?: any }} props
 */
export function TabPanel({ idBase, id, value, className, children }) {
  const active = id === value
  return (
    <div
      role="tabpanel"
      id={panelId(idBase, id)}
      aria-labelledby={tabId(idBase, id)}
      tabIndex={active ? 0 : undefined}
      hidden={!active}
      className={className}
    >
      {active ? children : null}
    </div>
  )
}
