// Maqola yo'llari va slug tekshiruvi — News, Archive, ListPage va maqola sahifalari uchun yagona manba

// Server bilan bir xil qoida (FIX-PLAN §2.3): yaroqsiz slug so'rovsiz 404
export const SLUG_RE = /^[a-z0-9-]{1,160}$/i

/** @param {unknown} slug */
export const isValidSlug = slug => typeof slug === 'string' && SLUG_RE.test(slug)

/** SofaScore yangiligi sahifasi */
export const newsPath = slug => `/news/${encodeURIComponent(slug)}`

/** Saytning o'z (store) maqolasi sahifasi */
export const articlePath = slug => `/article/${encodeURIComponent(slug)}`
