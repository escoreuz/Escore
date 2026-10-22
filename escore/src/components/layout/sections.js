// Sayt bo'limlari oq ro'yxati: Nav havolalari va /section/:name marshruti uchun yagona manba
export const SECTIONS = Object.freeze([
  { name: 'CHEMPIONLAR LIGASI', label: 'Chempionlar Ligasi' },
  { name: 'TRANSFER', label: 'Transfer' },
  { name: 'MILLIY TERMA', label: 'Milliy terma' },
  { name: 'TAHLIL', label: 'Tahlil' },
  { name: 'TAKTIKA', label: 'Taktika' },
  { name: 'INTERVYU', label: 'Intervyu' },
  // Store maqolalarida bor bo'lim; navigatsiya qatoriga chiqmaydi, lekin sahifasi ochiladi
  { name: 'MUXBIR USTUNI', label: 'Muxbir ustuni', inNav: false },
  // server/store.js: admin section bermasa default 'YANGILIK'
  { name: 'YANGILIK', label: 'Yangiliklar', inNav: false },
])

const SECTION_NAMES = new Set(SECTIONS.map(s => s.name))

/** @param {string} name */
export const isKnownSection = name => SECTION_NAMES.has(name)

/** @param {string} name */
export const sectionPath = name => `/section/${encodeURIComponent(name)}`
