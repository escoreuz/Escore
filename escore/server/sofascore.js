// SofaScore adapteri — façade. Lokal FastAPI (sofascore-api) dan real ma'lumot olib,
// eSCORE frontendi kutadigan shaklga aylantiradi. Amaliyot server/sofa/* modullarida:
//   http.js    — fetch + timeout + xato klassifikatsiyasi + TTL kesh + dedupe + parallellik cheklovi
//   events.js  — sana bo'yicha o'yinlar, bombardirlar, mini jadval, pickFeatured
//   match.js   — o'yin tafsiloti;  league.js — liga, davlatlar, reyting
//   team.js, player.js, people.js (murabbiy/hakam), news.js (yangilik/maqola/bosh sahifa)
//   image.js   — rasm proksisi;  dates.js — Asia/Tashkent sana yordamchilari
//
// Xato shartnomasi (FIX-PLAN §2.1): har eksport xatoda UpstreamError yoki NotFoundError
// (server/errors.js) tashlaydi. SofaScore anti-bot blokini aylanib o'tish TAQIQLANGAN.

export { days } from './sofa/dates.js'
export { matchesByDate, matchesForDate, pickFeatured, scorers, standingsMini } from './sofa/events.js'
export { matchDetail } from './sofa/match.js'
export { countries, countryLeagues, league, rankings } from './sofa/league.js'
export { team } from './sofa/team.js'
export { player, playerCareer, playerSeason } from './sofa/player.js'
export { coach, referee } from './sofa/people.js'
export { article, home, news } from './sofa/news.js'
export { fetchImage } from './sofa/image.js'
