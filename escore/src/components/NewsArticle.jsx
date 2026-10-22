// Yangilik batafsil sahifasi (SofaScore maqolasining o'zbekcha tarjimasi)
import { api, useApi } from '../api.js'
import { safeUrl } from '../lib/format.js'
import { Link } from '../lib/nav.jsx'
import { useSeo } from '../lib/seo.js'
import NotFound from './NotFound.jsx'
import { isoDate, newsArticleJsonLd, newsShareUrl } from './news/articleSeo.js'
import NewsImage from './news/NewsImage.jsx'
import PageError, { PageLoading } from './news/PageError.jsx'
import { isValidSlug, newsPath } from './news/paths.js'
import ShareBar from './news/ShareBar.jsx'

const HERO_WIDTH = 1200
const HERO_HEIGHT = 675

function ArticleBody({ blocks }) {
  return (
    <div className="na-body">
      {blocks.map((b, i) =>
        b?.type === 'h' ? (
          <h2 key={i} className="na-h2">
            {b.text}
          </h2>
        ) : (
          <p key={i} className={i === 0 ? 'dropcap' : ''}>
            {b?.text}
          </p>
        ),
      )}
    </div>
  )
}

function SourceNote({ sourceUrl }) {
  const href = safeUrl(sourceUrl)
  return (
    <p>
      Manba:{' '}
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          SofaScore
        </a>
      ) : (
        'SofaScore'
      )}{' '}
      · o'zbek tiliga avtomatik tarjima qilingan.
    </p>
  )
}

function NewsArticleView({ a, slug }) {
  const path = newsPath(slug)
  const title = a.title || 'Maqola'
  const image = safeUrl(a.image)
  const published = isoDate(a.date)
  const blocks = Array.isArray(a.blocks) ? a.blocks : []
  useSeo({
    title,
    description: a.excerpt,
    image: image ?? undefined,
    path,
    type: 'article',
    jsonLd: newsArticleJsonLd({ headline: title, description: a.excerpt, image, date: a.date, author: a.author, path }),
  })

  return (
    <article className="na">
      <Link to="/news" className="article__back">
        ← Yangiliklar
      </Link>

      <header className="na-head">
        <p className="kicker">{a.league || 'YANGILIK'}</p>
        <h1 className="na-title">{title}</h1>
        {a.excerpt && <p className="na-standfirst">{a.excerpt}</p>}
        <div className="na-meta">
          {a.author && <span>✍ {a.author}</span>}
          {published ? <time dateTime={published}>{a.time ?? '—'}</time> : <span>{a.time ?? '—'}</span>}
        </div>
      </header>

      {a.translationComplete === false && (
        <p className="unavailable" role="note">
          Avtomatik tarjima to'liq emas — matnning bir qismi asl tilda qolgan bo'lishi mumkin.
        </p>
      )}

      {image && (
        <figure className="na-figure">
          {/* Hero rasm yuklanmasa fallback figure tashqarisiga chiqmasligi uchun bo'sh qoldiriladi */}
          <NewsImage
            src={image}
            alt={title}
            className="na-figure__img"
            fallbackClassName={null}
            width={HERO_WIDTH}
            height={HERO_HEIGHT}
            eager
          />
        </figure>
      )}

      <ArticleBody blocks={blocks} />
      <ShareBar url={newsShareUrl(api.base, slug)} title={title} />

      <footer className="na-foot">
        <SourceNote sourceUrl={a.sourceUrl} />
        <Link to="/news" className="readmore">
          ← Barcha yangiliklar
        </Link>
      </footer>
    </article>
  )
}

function NewsArticleLoader({ slug }) {
  const { data, error, loading, reload } = useApi(o => api.newsArticle(slug, o), [slug])
  if (loading) return <PageLoading />
  if (error) return <PageError error={error} onRetry={reload} />
  if (!data) return <NotFound />
  return <NewsArticleView a={data} slug={slug} />
}

export default function NewsArticle({ slug }) {
  // Yaroqsiz slug — serverga so'rovsiz 404
  if (!isValidSlug(slug)) return <NotFound />
  return <NewsArticleLoader slug={slug} />
}
