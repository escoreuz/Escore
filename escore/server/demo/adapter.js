// DEMO adapter — `sofascore.js` bilan bir xil ommaviy interfeys, lekin lokal demo
// ma'lumotdan ishlaydi. FAQAT USE_REAL=0 da ulanadi (index.js). Real rejimda hech
// qachon import qilinmaydi va real ma'lumotga aralashmaydi (FIX-PLAN §1).
// Lug'atlardan olish faqat Map/Set orqali — prototip kalitlari (constructor, __proto__) xavfsiz.
import { NotFoundError } from '../errors.js'
import { createLiveEngine, addDays } from '../live.js'
import { TICKER, STANDINGS, RESULTS, FIXTURES, BRIEFS, QUOTE } from './news.js'
import { TODAY, LEAGUES, MATCHES, SCORERS, STANDINGS_MINI } from './score.js'
import { getMatchDetails, REFEREES } from './matchDetails.js'
import { TEAMS, getLeagueTable, getLeagueScorers } from './leagueData.js'
import { getTeam } from './teamData.js'
import { getPlayer } from './playerData.js'
import { getCoach } from './coachData.js'
import { getReferee } from './refereeData.js'

const DAY_RANGE = 2 // bugun ± 2 kun
const DOW = ['YAK', 'DUSH', 'SESH', 'CHOR', 'PAY', 'JUM', 'SHA']
const DOW_LABEL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
const PLAYER_ID_SEPARATOR = '--'

/** Demo nom → URL-xavfsiz ID ('Man City' → 'man-city'). */
export function demoSlug(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const slugMap = names => new Map(names.map(n => [demoSlug(n), n]))

function required(value, what) {
  if (value === null || value === undefined) throw new NotFoundError(`${what} topilmadi`)
  return value
}

function buildDays(today) {
  const days = []
  for (let off = -DAY_RANGE; off <= DAY_RANGE; off++) {
    const date = addDays(today, off)
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
    days.push({ date, dow: DOW[dow], d: date.slice(8, 10), label: off === 0 ? 'Bugun' : DOW_LABEL[dow] })
  }
  return { today, days }
}

/**
 * @param {{ today?: string, intervalMs?: number }} [opts]
 */
export function createDemoAdapter({ today, intervalMs } = {}) {
  const live = createLiveEngine({ matches: MATCHES, baseDate: TODAY, today, intervalMs })
  const leagueIds = new Set(LEAGUES.map(l => l.id))
  const teamNames = slugMap([...new Set(Object.values(TEAMS).flat())])
  const refereeNames = slugMap(REFEREES)

  const teamName = id => required(teamNames.get(id), 'Jamoa')
  // Statik o'yin ro'yxatini jonli (sanasi surilgan) nusxa bilan almashtiramiz
  const withLive = matches => matches.map(m => (m.id && live.getOne(m.id)) || m)

  function findPlayer(id) {
    const [teamId, playerId] = String(id).split(PLAYER_ID_SEPARATOR)
    const team = teamName(teamId)
    const players = getTeam(team).squad.flatMap(g => g.players)
    const found = required(
      players.find(p => demoSlug(p.name) === playerId),
      "O'yinchi",
    )
    return getPlayer(team, found.name, found.pos)
  }

  return {
    start: () => live.start(),
    stop: () => live.stop(),
    days: () => buildDays(live.today),
    matchesByDate: async date => live.getAll().filter(m => m.date === date),
    matchesForDate: async date => ({ matches: live.getAll().filter(m => m.date === date), partial: false }),
    async matchDetail(id) {
      const details = required(getMatchDetails(id), "O'yin")
      return { ...details, match: { ...details.match, ...live.getOne(id) } }
    },
    scorers: async () => SCORERS,
    standingsMini: async () => STANDINGS_MINI,
    async league(id) {
      if (!leagueIds.has(id)) throw new NotFoundError('Liga topilmadi')
      const matches = live.getAll().filter(m => m.leagueId === id)
      return { ...getLeagueTable(id), scorers: getLeagueScorers(id), matches }
    },
    async team(id) {
      const data = getTeam(teamName(id))
      return { ...data, matches: withLive(data.matches) }
    },
    player: async id => findPlayer(id),
    playerCareer: async () => ({ isGK: false, rows: [] }),
    playerSeason: async () => {
      throw new NotFoundError("Mavsum statistikasi demo rejimda yo'q")
    },
    async coach(id) {
      const team = teamName(id)
      const data = getCoach(team, getTeam(team).info.coach)
      return { ...data, matches: withLive(data.matches) }
    },
    async referee(id) {
      const data = getReferee(required(refereeNames.get(id), 'Hakam'))
      return { ...data, matches: withLive(data.matches) }
    },
    // Yangilik bloklarini app tahririyat ombori (store) dan oladi — lead: null
    home: async () => ({
      lead: null,
      secondary: [],
      columns: [],
      briefs: BRIEFS,
      ticker: TICKER,
      quote: QUOTE,
      standings: STANDINGS,
      results: RESULTS,
      fixtures: FIXTURES,
    }),
    news: async () => [],
    article: async () => {
      throw new NotFoundError('Maqola topilmadi')
    },
    countries: async () => [],
    countryLeagues: async () => [],
    rankings: async () => [],
    fetchImage: async () => {
      throw new NotFoundError("Demo rejimda rasm yo'q")
    },
  }
}
