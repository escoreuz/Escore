// API-Football (api-sports.io v3) adapteri — façade. sofascore.js bilan BIR XIL eksport nomlari va
// javob shakllari (docs/API-NOTES.md). Kvota: disk+xotira kesh, TTL, dedupe, ≤8/daq, kunlik byudjet.
// Kalit faqat process.env.APISPORTS_KEY dan; kodda, logda va xato matnlarida YO'Q.
//
// API'da yo'q imkoniyatlar: yangiliklar (news → [], article → 404), hakam sahifasi (404),
// FIFA/UEFA reytingi (404), o'yinchi atributlari/heatmap/oylik reyting, momentum, bashorat (vote).

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NotFoundError } from './errors.js'
import { createClient } from './apisports/client.js'
import { createDiskCache } from './apisports/disk-cache.js'
import * as entities from './apisports/entities.js'
import { createImageFetcher } from './apisports/image.js'
import * as matches from './apisports/matches.js'
import * as players from './apisports/players.js'
import { days } from './sofa/dates.js'

const DEFAULT_BASE_URL = 'https://v3.football.api-sports.io'
const CACHE_FILE = 'apisports-cache.json'
const DEFAULT_DATA_DIR = fileURLToPath(new URL('./db', import.meta.url))

/**
 * Adapter yaratish (testlar client/fetch'ni almashtiradi).
 * @param {{ client: ReturnType<typeof createClient>, fetchImage?: Function }} deps
 */
export function createApisportsAdapter({ client, fetchImage = createImageFetcher() }) {
  const bind = (mod, names) => Object.fromEntries(names.map(n => [n, (...args) => mod[n](client, ...args)]))
  const notAvailable = what => async () => {
    throw new NotFoundError(`API-Football'da ${what} yo'q`)
  }
  return {
    days,
    pickFeatured: matches.pickFeatured,
    ...bind(matches, ['matchesForDate', 'matchDetail', 'scorers', 'standingsMini', 'home']),
    matchesByDate: async date => (await matches.matchesForDate(client, date)).matches,
    ...bind(entities, ['league', 'team', 'coach', 'countryLeagues']),
    countries: () => entities.countryList(client),
    ...bind(players, ['player', 'playerCareer', 'playerSeason']),
    referee: notAvailable('hakam sahifasi'),
    rankings: notAvailable('FIFA/UEFA reytingi'),
    article: notAvailable('maqolalar'),
    news: async () => [], // yangiliklar API'da yo'q — bosh sahifa store maqolalariga tushadi
    fetchImage,
    stats: () => client.stats(),
    stop: () => client.flush(),
  }
}

/** Muhitdan sozlangan adapter. Kalit yo'q bo'lsa aniq xato (kalit qiymati chiqarilmaydi). */
export function createFromEnv(env = process.env) {
  const dataDir = env.ESCORE_DATA_DIR || DEFAULT_DATA_DIR
  const store = createDiskCache({ file: join(dataDir, CACHE_FILE) })
  const client = createClient({ baseUrl: env.APISPORTS_BASE_URL || DEFAULT_BASE_URL, key: env.APISPORTS_KEY, store })
  return createApisportsAdapter({ client })
}

let adapter = null
const lazy =
  name =>
  (...args) => {
    adapter ??= createFromEnv()
    return adapter[name](...args)
  }

export { days }
export const pickFeatured = lazy('pickFeatured')
export const matchesForDate = lazy('matchesForDate')
export const matchesByDate = lazy('matchesByDate')
export const matchDetail = lazy('matchDetail')
export const scorers = lazy('scorers')
export const standingsMini = lazy('standingsMini')
export const home = lazy('home')
export const league = lazy('league')
export const team = lazy('team')
export const coach = lazy('coach')
export const countries = lazy('countries')
export const countryLeagues = lazy('countryLeagues')
export const player = lazy('player')
export const playerCareer = lazy('playerCareer')
export const playerSeason = lazy('playerSeason')
export const referee = lazy('referee')
export const rankings = lazy('rankings')
export const article = lazy('article')
export const news = lazy('news')
export const fetchImage = lazy('fetchImage')
export const stats = lazy('stats')
export const stop = () => adapter?.stop()
