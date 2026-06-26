// Score (jonli hisoblar) sahifasi uchun ma'lumotlar

export const TODAY = '2026-06-23'

export const DAYS = [
  { date: '2026-06-21', dow: 'YAK', d: '21', label: 'Yakshanba' },
  { date: '2026-06-22', dow: 'DUSH', d: '22', label: 'Dushanba' },
  { date: '2026-06-23', dow: 'SESH', d: '23', label: 'Bugun' },
  { date: '2026-06-24', dow: 'CHOR', d: '24', label: 'Chorshanba' },
  { date: '2026-06-25', dow: 'PAY', d: '25', label: 'Payshanba' },
]

export const LEAGUES = [
  { id: 'epl', country: 'Angliya', name: 'Premyer-liga', flag: '🏴' },
  { id: 'cha', country: 'Angliya', name: 'Chempionship', flag: '🏴' },
  { id: 'laliga', country: 'Ispaniya', name: 'La Liga', flag: '🇪🇸' },
  { id: 'seriea', country: 'Italiya', name: 'Seriya A', flag: '🇮🇹' },
  { id: 'uzs', country: 'O\'zbekiston', name: 'Superliga', flag: '🇺🇿' },
  { id: 'ucl', country: 'Yevropa', name: 'Chempionlar ligasi', flag: '🏆' },
]

const t = (n, c) => ({ n, c })

// status: 'live' | 'ft' | 'sched'
export const MATCHES = [
  // ---- Bugun (23) ----
  { id: 'm1', date: '2026-06-23', leagueId: 'epl', time: '18:30', status: 'live', minute: 67, home: t('Arsenal', '#e3000b'), away: t('Chelsea', '#1f3a8a'), hs: 2, as: 1, odds: [1.9, 3.4, 4.1] },
  { id: 'm2', date: '2026-06-23', leagueId: 'epl', time: '19:00', status: 'live', minute: 31, home: t('Liverpool', '#c8102e'), away: t('Everton', '#003399'), hs: 0, as: 0, odds: [1.5, 4.2, 6.0] },
  { id: 'm3', date: '2026-06-23', leagueId: 'epl', time: '21:00', status: 'sched', home: t('Man City', '#6caddf'), away: t('Tottenham', '#132257'), odds: [1.7, 3.9, 4.6] },
  { id: 'm4', date: '2026-06-23', leagueId: 'laliga', time: '18:00', status: 'live', minute: 78, home: t('Real Madrid', '#c9a227'), away: t('Sevilla', '#d81e05'), hs: 3, as: 1, odds: [1.4, 4.5, 7.0] },
  { id: 'm5', date: '2026-06-23', leagueId: 'laliga', time: '23:00', status: 'sched', home: t('Barcelona', '#a50044'), away: t('Valencia', '#ee3524'), odds: [1.6, 4.0, 5.2] },
  { id: 'm6', date: '2026-06-23', leagueId: 'seriea', time: '16:00', status: 'ft', minute: 90, home: t('Inter', '#0b1f5e'), away: t('Milan', '#fb090b'), hs: 2, as: 2, odds: [2.1, 3.3, 3.4] },
  { id: 'm7', date: '2026-06-23', leagueId: 'seriea', time: '22:45', status: 'sched', home: t('Juventus', '#1a1a1a'), away: t('Napoli', '#12a0d7'), odds: [2.4, 3.1, 3.0] },
  { id: 'm8', date: '2026-06-23', leagueId: 'uzs', time: '17:00', status: 'live', minute: 55, home: t('Pakhtakor', '#1f5130'), away: t('Nasaf', '#1e73be'), hs: 1, as: 0, odds: [1.8, 3.2, 4.4] },
  { id: 'm9', date: '2026-06-23', leagueId: 'uzs', time: '19:00', status: 'sched', home: t('AGMK', '#f7941e'), away: t('Bunyodkor', '#d52b1e'), odds: [2.2, 3.0, 3.3] },
  { id: 'm10', date: '2026-06-23', leagueId: 'ucl', time: '23:00', status: 'sched', home: t('Bayern', '#dc052d'), away: t('PSG', '#004170'), odds: [2.0, 3.6, 3.5] },

  // ---- Kecha (22) — tugagan ----
  { id: 'm11', date: '2026-06-22', leagueId: 'epl', time: '17:00', status: 'ft', minute: 90, home: t('Newcastle', '#241f20'), away: t('Brighton', '#0057b8'), hs: 1, as: 1, odds: [2.0, 3.3, 3.7] },
  { id: 'm12', date: '2026-06-22', leagueId: 'epl', time: '19:30', status: 'ft', minute: 90, home: t('Aston Villa', '#7b003a'), away: t('Fulham', '#1a1a1a'), hs: 3, as: 0, odds: [1.7, 3.8, 4.6] },
  { id: 'm13', date: '2026-06-22', leagueId: 'laliga', time: '21:00', status: 'ft', minute: 90, home: t('Atletico', '#cb3524'), away: t('Betis', '#009b3a'), hs: 2, as: 0, odds: [1.6, 3.9, 5.5] },
  { id: 'm14', date: '2026-06-22', leagueId: 'uzs', time: '18:00', status: 'ft', minute: 90, home: t('Navbahor', '#1e8c3a'), away: t('Surxon', '#1e73be'), hs: 2, as: 1, odds: [1.9, 3.2, 4.0] },

  // ---- Ertaga (24) — rejada ----
  { id: 'm15', date: '2026-06-24', leagueId: 'epl', time: '20:00', status: 'sched', home: t('Brentford', '#e30613'), away: t('Wolves', '#fdb913'), odds: [2.3, 3.3, 3.1] },
  { id: 'm16', date: '2026-06-24', leagueId: 'seriea', time: '22:45', status: 'sched', home: t('Roma', '#8e1f2f'), away: t('Lazio', '#5aa9e6'), odds: [2.2, 3.2, 3.3] },
  { id: 'm17', date: '2026-06-24', leagueId: 'ucl', time: '23:00', status: 'sched', home: t('Real Madrid', '#c9a227'), away: t('Man City', '#6caddf'), odds: [2.5, 3.5, 2.7] },
  { id: 'm18', date: '2026-06-24', leagueId: 'uzs', time: '19:30', status: 'sched', home: t('Pakhtakor', '#1f5130'), away: t('AGMK', '#f7941e'), odds: [1.7, 3.4, 4.8] },
]

export const SCORERS = [
  { rank: 1, name: 'E. Holland', team: 'Man City', goals: 28, c: '#6caddf' },
  { rank: 2, name: 'M. Salah', team: 'Liverpool', goals: 24, c: '#c8102e' },
  { rank: 3, name: 'K. Mbappe', team: 'Real Madrid', goals: 23, c: '#c9a227' },
  { rank: 4, name: 'L. Martinez', team: 'Inter', goals: 21, c: '#0b1f5e' },
  { rank: 5, name: 'R. Lewandowski', team: 'Barcelona', goals: 19, c: '#a50044' },
  { rank: 6, name: 'O. Zoyirov', team: 'Pakhtakor', goals: 17, c: '#1f5130' },
]

export const STANDINGS_MINI = [
  { pos: 1, club: 'Man City', pts: 83 },
  { pos: 2, club: 'Arsenal', pts: 81 },
  { pos: 3, club: 'Liverpool', pts: 76 },
  { pos: 4, club: 'Real Madrid', pts: 74 },
  { pos: 5, club: 'Inter', pts: 72 },
]
