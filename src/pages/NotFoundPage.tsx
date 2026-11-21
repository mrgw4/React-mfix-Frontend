import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title" className="not-found">
      <div className="not-found-content">
        <span className="not-found-code">404 — OUT OF FRAME</span>
        <h1 id="not-found-title">Page not found</h1>
        <p>We couldn&apos;t find that page. It may have moved, or the address might be mistyped.</p>
        <Link className="not-found-link" to="/">
          <ArrowLeft aria-hidden="true" size={16} />
          Back to Discover
        </Link>
      </div>
    </section>
  )
}

export default NotFoundPage
