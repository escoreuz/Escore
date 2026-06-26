// Ingliz tilidagi yangilik sarlavhalarini o'zbekchaga tarjima qiluvchi modul.
// Avval futbol atamalari lug'ati (aniq va tez), keyin Google Translate (bepul,
// rasmiy bo'lmagan endpoint) zaxira sifatida. Natijalar xotirada keshlanadi.

// ---- Futbol atamalari lug'ati (kichik harflarda) ----
const GLOSSARY = {
  'full highlights': 'To\'liq sharh',
  'extended highlights': 'Kengaytirilgan sharh',
  'highlights': 'Sharh',
  'all goals': 'Barcha gollar',
  'goals': 'Gollar',
  'goals and highlights': 'Gollar va sharh',
  'all goals and highlights': 'Barcha gollar va sharh',
  'match highlights': 'O\'yin sharhi',
  'post-match': 'O\'yindan keyin',
  'post match': 'O\'yindan keyin',
  'pre-match': 'O\'yin oldidan',
  'interview': 'Intervyu',
  'press conference': 'Matbuot anjumani',
  'reaction': 'Reaksiya',
  'best moments': 'Eng yaxshi lahzalar',
  'key moments': 'Asosiy lahzalar',
  'penalty': 'Penalti',
  'penalties': 'Penaltilar',
  'red card': 'Qizil kartochka',
  'great goal': 'Ajoyib gol',
}

const cache = new Map()

// Sof "Jamoa X - Y Jamoa" hisob satrimi? (raqam + tire + raqam bor)
function isScoreLine(s) {
  return /\d+\s*[-–:]\s*\d+/.test(s) && s.length < 40
}

async function googleTranslate(text) {
  // sl=auto — manba tilini avtomatik aniqlaydi (ingliz, xorvat, ispan... → o'zbek)
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=uz&dt=t&q=' +
    encodeURIComponent(text)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error('gt ' + r.status)
    const data = await r.json()
    return (data[0] || []).map((seg) => seg[0]).join('') || text
  } finally {
    clearTimeout(timer)
  }
}

// Bitta matnni tarjima qiladi (lug'at → kesh → Google → asl matn)
export async function translate(text) {
  const t = (text || '').trim()
  if (!t) return ''
  const key = t.toLowerCase()
  if (GLOSSARY[key]) return GLOSSARY[key]
  if (cache.has(t)) return cache.get(t)
  // Hisob satrlari (asosan ism+raqam) — baribir tarjima qilamiz (ismlar transliteratsiya bo'ladi),
  // lekin juda qisqa/raqamli bo'lsa Google yaxshi ishlaydi.
  try {
    const out = await googleTranslate(t)
    cache.set(t, out)
    return out
  } catch {
    return t // tarjima bo'lmasa asl matn
  }
}

// Bir nechta matnni parallel tarjima qiladi
export async function translateAll(texts) {
  return Promise.all(texts.map((x) => translate(x)))
}
