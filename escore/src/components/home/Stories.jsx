// Bosh sahifaning ikkinchi darajali bloklari: maqolalar, ustunlar, iqtibos
import StoryLink, { DUPLICATE_LINK_PROPS } from './StoryLink.jsx'

const THUMB = { width: 640, height: 360 }

export function SecondaryStories({ items }) {
  if (!items?.length) return null
  return (
    <div className="secondary">
      {items.map((s, i) => (
        <article key={s.slug || i} className="secondary__item">
          {s.image && (
            <StoryLink a={s} className="secondary__media" {...DUPLICATE_LINK_PROPS}>
              <img src={s.image} alt={s.title} loading="lazy" {...THUMB} />
            </StoryLink>
          )}
          <p className="kicker kicker--sm">{s.kicker}</p>
          <h3>
            <StoryLink a={s} className="article__link">
              {s.title}
            </StoryLink>
          </h3>
          <p>{s.standfirst}</p>
          <StoryLink a={s} className="readmore">
            Davomini o'qish<span className="sr-only">: {s.title}</span> →
          </StoryLink>
        </article>
      ))}
    </div>
  )
}

export function Columns({ items }) {
  if (!items?.length) return null
  return (
    <div className="columns">
      {items.map((c, i) => (
        <article key={c.slug || i} className="columns__item">
          <p className="kicker kicker--sm">{c.kicker}</p>
          <h3>
            <StoryLink a={c} className="article__link">
              {c.title}
            </StoryLink>
          </h3>
          <p>{c.standfirst}</p>
          {c.author && <p className="columns__author">— {c.author}</p>}
        </article>
      ))}
    </div>
  )
}

export function Quote({ quote }) {
  if (!quote?.text) return null
  return (
    <blockquote className="pullquote">
      <span className="pullquote__mark" aria-hidden="true">
        “
      </span>
      <p>{quote.text}</p>
      {quote.author && <cite>— {quote.author}</cite>}
    </blockquote>
  )
}
