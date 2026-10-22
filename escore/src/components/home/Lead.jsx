// Bosh maqola (LCP elementi: rasm lazy EMAS, fetchpriority="high")
import StoryLink, { DUPLICATE_LINK_PROPS } from './StoryLink.jsx'

const LEAD_BODY_PARAGRAPHS = 2
const LEAD_IMG = { width: 1200, height: 675 }

export default function Lead({ a }) {
  if (!a) return null
  return (
    <article className="lead">
      <p className="kicker">{a.kicker}</p>
      <h2 className="lead__title">
        <StoryLink a={a} className="article__link">
          {a.title}
        </StoryLink>
      </h2>
      <p className="lead__standfirst">{a.standfirst}</p>

      <figure className="lead__figure">
        <StoryLink a={a} className="lead__photo" {...DUPLICATE_LINK_PROPS}>
          {a.image ? (
            <img className="lead__img" src={a.image} alt={a.title} fetchpriority="high" {...LEAD_IMG} />
          ) : (
            <div className="lead__photo-grid" />
          )}
          {a.photoTag && <span className="lead__photo-tag">{a.photoTag}</span>}
        </StoryLink>
        {a.caption && <figcaption>{a.caption}</figcaption>}
      </figure>

      <div className="lead__body">
        {(a.body || []).slice(0, LEAD_BODY_PARAGRAPHS).map((p, i) => (
          <p key={i} className={i === 0 ? 'dropcap' : undefined}>
            {p}
          </p>
        ))}
        <p className="lead__continue">
          <StoryLink a={a} className="readmore">
            Davomini o'qish<span className="sr-only">: {a.title}</span> →
          </StoryLink>
        </p>
      </div>
    </article>
  )
}
