import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tabs, TabPanel } from './Tabs.jsx'

const TABS = [
  { id: 'sharh', label: 'Sharh' },
  { id: 'stat', label: 'Statistika' },
  { id: 'tarkib', label: 'Tarkib' },
]

function Harness({ initial = 'sharh' }) {
  const [tab, setTab] = useState(initial)
  return (
    <>
      <Tabs tabs={TABS} value={tab} onChange={setTab} idBase="m" label="O'yin bo'limlari" />
      {TABS.map(t => (
        <TabPanel key={t.id} idBase="m" id={t.id} value={tab}>
          {t.label} paneli
        </TabPanel>
      ))}
    </>
  )
}

const selected = () => screen.getByRole('tab', { selected: true })

describe('Tabs', () => {
  it('ARIA tab naqshi: tablist, aria-selected, aria-controls, tabpanel aria-labelledby', () => {
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: "O'yin bo'limlari" })).toBeInTheDocument()
    const tab = screen.getByRole('tab', { name: 'Sharh' })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(tab).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Tarkib' })).toHaveAttribute('tabindex', '-1')
    const panel = screen.getByRole('tabpanel')
    expect(tab).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', tab.id)
    expect(panel).toHaveTextContent('Sharh paneli')
  })

  it('ArrowRight/ArrowLeft aylanib o`tadi va fokusni ko`chiradi', () => {
    render(<Harness />)
    fireEvent.keyDown(selected(), { key: 'ArrowRight' })
    expect(selected()).toHaveTextContent('Statistika')
    expect(document.activeElement).toBe(selected())
    fireEvent.keyDown(selected(), { key: 'ArrowRight' })
    fireEvent.keyDown(selected(), { key: 'ArrowRight' })
    expect(selected()).toHaveTextContent('Sharh')
    fireEvent.keyDown(selected(), { key: 'ArrowLeft' })
    expect(selected()).toHaveTextContent('Tarkib')
  })

  it('Home/End birinchi va oxirgi tabga o`tadi', () => {
    render(<Harness initial="stat" />)
    fireEvent.keyDown(selected(), { key: 'End' })
    expect(selected()).toHaveTextContent('Tarkib')
    fireEvent.keyDown(selected(), { key: 'Home' })
    expect(selected()).toHaveTextContent('Sharh')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Sharh paneli')
  })

  it('boshqa tugmalar tanlovni o`zgartirmaydi; bosish tanlaydi', () => {
    render(<Harness />)
    fireEvent.keyDown(selected(), { key: 'a' })
    expect(selected()).toHaveTextContent('Sharh')
    fireEvent.click(screen.getByRole('tab', { name: 'Tarkib' }))
    expect(selected()).toHaveTextContent('Tarkib')
    expect(screen.getByRole('tab', { name: 'Tarkib' })).toHaveClass('mp-tab', 'is-sel')
  })

  it("noma'lum value bo'lsa birinchi tab fokuslanadigan bo'ladi", () => {
    render(<Tabs tabs={TABS} value="yoq" onChange={() => {}} idBase="x" label="L" />)
    expect(screen.getByRole('tab', { name: 'Sharh' })).toHaveAttribute('tabindex', '0')
  })
})

describe('Tabs — modifikatorlar (F7)', () => {
  it.each([['altKey'], ['ctrlKey'], ['metaKey'], ['shiftKey']])('%s + ArrowRight tanlovni o`zgartirmaydi', mod => {
    render(<Harness />)
    fireEvent.keyDown(selected(), { key: 'ArrowRight', [mod]: true })
    expect(selected()).toHaveTextContent('Sharh')
  })
})
