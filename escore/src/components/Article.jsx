// Saytning o'z (tahririyat) maqolasi: /article/:slug
import { api, useApi } from '../api.js'
import { safeUrl } from '../lib/format.js'
import { Link } from '../lib/nav.jsx'
import { siteUrl, useSeo } from '../lib/seo.js'
import NotFound from './NotFound.jsx'
import { newsArticleJsonLd } from './news/articleSeo.js'
import NewsImage from './news/NewsImage.jsx'
import PageError, { PageLoading } from './news/PageError.jsx'
import { articlePath, isValidSlug } from './news/paths.js'
import ShareBar from './news/ShareBar.jsx'

const RELATED_LIMIT = 3
const HERO_WIDTH = 1200
const HERO_HEIGHT = 675

function RelatedArticles({ slug }) {
  const { data, error, loading } = useApi(o => api.news(o), [])
  if (loading) return null
  if (error) return <p className="unavailable">O'xshash maqolalarni yuklab bo'lmadi.</p>
  const related = (Array.isArray(data) ? data : []).filter(a => a?.slug && a.slug !== slug).slice(0, RELATED_LIMIT)
  if (related.length === 0) return null
  return (
    <section className="article__related" aria-labelledby="related-title">
      <h2 id="related-title" className="box__title box__title--plain">
        SHUNINGDEK O'QING
      </h2>
      <div className="columns">
        {related.map(a => (
          <article key={a.slug} className="columns__item">
            {a.kicker && <p className="kicker kicker--sm">{a.kicker}</p>}
            <h3>
              <Link to={articlePath(a.slug)} className="article__link">
                {a.title || 'Sarlavhasiz maqola'}
              </Link>
            </h3>
            {a.standfirst && <p>{a.standfirst}</p>}
            <Link to={articlePath(a.slug)} className="readmore" tabIndex={-1} aria-hidden="true">
              Davomini o'qish →
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}

function ArticleFigure({ article, title }) {
  const image = safeUrl(article.image)
  return (
    <figure className="article__figure">
      {image ? (
        // Hero rasm yuklanmasa fallback figure tashqarisiga chiqmasligi uchun bo'sh qoldiriladi
        <NewsImage
          src={image}
          alt={title}
          className="article__img"
          fallbackClassName={null}
          width={HERO_WIDTH}
          height={HERO_HEIGHT}
          eager
        />
      ) : (
        <div className="lead__photo" aria-hidden="true">
          <div className="lead__photo-grid" />
          {article.photoTag && <span className="lead__photo-tag">{article.photoTag}</span>}
        </div>
      )}
      {article.caption && <figcaption>{article.caption}</figcaption>}
    </figure>
  )
}

function Tags({ tags }) {
  if (!Array.isArray(tags) || tags.length === 0) return null
  return (
    <p className="article__tags">
      <span className="kicker kicker--sm">TEGLAR: </span>
      {tags.map(t => (
        <span key={t} className="article__tag">
          #{t}{' '}
        </span>
      ))}
    </p>
  )
}

function ArticleView({ article, slug }) {
  const path = articlePath(slug)
  const title = article.title || 'Maqola'
  const body = Array.isArray(article.body) ? article.body : []
  useSeo({
    title,
    description: article.standfirst,
    image: safeUrl(article.image) ?? undefined,
    path,
    type: 'article',
    jsonLd: newsArticleJsonLd({
      headline: title,
      description: article.standfirst,
      image: article.image,
      date: article.publishedAt ?? article.date,
      author: article.author,
      path,
    }),
  })

  return (
    <article className="article">
      <Link to="/" className="article__back">
        ← Bosh sahifa
      </Link>
      <header className="article__head">
        <p className="kicker">{article.kicker ?? '—'}</p>
        <h1 className="article__title">{title}</h1>
        {article.standfirst && <p className="article__standfirst">{article.standfirst}</p>}
        <div className="article__meta">
          <span className="article__author">{article.author ?? '—'}</span>
          <span className="article__dot">•</span>
          <span>{article.date ?? '—'}</span>
          <span className="article__dot">•</span>
          <span>{article.readTime ?? '—'}</span>
        </div>
      </header>
      <ArticleFigure article={article} title={title} />
      <div className="article__body">
        {body.map((p, i) => (
          <p key={i} className={i === 0 ? 'dropcap' : ''}>
            {p}
          </p>
        ))}
      </div>
      <Tags tags={article.tags} />
      <ShareBar url={siteUrl() + path} title={title} />
      <hr className="hr" />
      <RelatedArticles slug={slug} />
    </article>
  )
}

function ArticleLoader({ slug }) {
  const { data, error, loading, reload } = useApi(o => api.article(slug, o), [slug])
  if (loading) return <PageLoading />
  if (error) return <PageError error={error} onRetry={reload} />
  if (!data) return <NotFound />
  return <ArticleView article={data} slug={slug} />
}

export default function Article({ slug }) {
  // Yaroqsiz slug — serverga so'rovsiz 404
  if (!isValidSlug(slug)) return <NotFound />
  return <ArticleLoader slug={slug} />
}
