import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bookmark, Check, Film, Heart, MessageCircle, Play, Search, Send, SlidersHorizontal, Sparkles, Star, X } from 'lucide-react'
import { createComment, getComments, getMovie, getMovies, type Movie, type MovieComment, type MoviePage } from '../api'
import { useAppShell } from '../layout/AppShellContext'

const emptyPagination: MoviePage['pagination'] = {
  page: 1,
  limit: 30,
  total: 0,
  pages: 0,
  hasNextPage: false,
  hasPrevPage: false,
}
const moviesPerPage = 30

function DiscoverPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [pagination, setPagination] = useState(emptyPagination)
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [comments, setComments] = useState<MovieComment[]>([])
  const [commentName, setCommentName] = useState('')
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const { search, genres, genresError, activeGenre, setActiveGenre, sortByRating, setSortByRating, showWatchlist, setShowWatchlist, savedMovies, toggleSaved } = useAppShell()
  const previousFilters = useRef({ search: debouncedSearch, activeGenre, sortByRating, showWatchlist })
  const savedMoviesKey = showWatchlist ? savedMovies.join('\u001f') : ''

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let active = true
    const filters = { search: debouncedSearch, activeGenre, sortByRating, showWatchlist }
    const filtersChanged = filters.search !== previousFilters.current.search
      || filters.activeGenre !== previousFilters.current.activeGenre
      || filters.sortByRating !== previousFilters.current.sortByRating
      || filters.showWatchlist !== previousFilters.current.showWatchlist
    previousFilters.current = filters
    if (filtersChanged && page !== 1) {
      setIsLoading(true)
      setMovies([])
      setPage(1)
      return () => { active = false }
    }

    setIsLoading(true)
    setLoadError('')
    setMovies([])
    const watchlistIds = savedMoviesKey ? savedMoviesKey.split('\u001f') : []
    const watchlistPages = Math.ceil(watchlistIds.length / moviesPerPage)
    const watchlistPage = Math.min(page, Math.max(watchlistPages, 1))
    const loadResults = showWatchlist
      ? Promise.all(watchlistIds.slice((watchlistPage - 1) * moviesPerPage, watchlistPage * moviesPerPage).map((movieId) => getMovie(movieId))).then((results) => ({
        movies: results,
        pagination: {
          page: watchlistPage,
          limit: moviesPerPage,
          total: watchlistIds.length,
          pages: watchlistPages,
          hasNextPage: watchlistPage < watchlistPages,
          hasPrevPage: watchlistPage > 1,
        },
      }))
      : getMovies({ page, genre: activeGenre, search: debouncedSearch, sortByRating })

    loadResults.then((result) => {
      if (active) {
        setMovies(result.movies)
        setPagination(result.pagination)
      }
    }).catch((error: unknown) => {
      if (active) {
        setMovies([])
        setLoadError(error instanceof Error ? error.message : 'Could not load films.')
      }
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => { active = false }
  }, [page, debouncedSearch, activeGenre, sortByRating, showWatchlist, savedMoviesKey, reloadKey])

  useEffect(() => {
    if (!selectedMovie) return
    let active = true
    getComments(selectedMovie.id).then((results) => {
      if (active) setComments(results)
    }).catch(() => { if (active) setComments([]) })
    return () => { active = false }
  }, [selectedMovie])

  const filteredMovies = showWatchlist
    ? [...movies].sort((first, second) => sortByRating ? second.rating - first.rating : second.year - first.year)
    : movies
  const featuredMovie = movies[0]

  function openMovie(movie: Movie) {
    setComments([])
    setCommentError('')
    setSelectedMovie(movie)
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedMovie || !commentName.trim() || !commentText.trim()) return
    setCommentLoading(true)
    setCommentError('')
    try {
      const created = await createComment({ movieId: selectedMovie.id, name: commentName.trim(), text: commentText.trim() })
      setComments((current) => [created, ...current])
      setCommentText('')
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : 'Could not post your comment.')
    } finally {
      setCommentLoading(false)
    }
  }

  return <div className="content-wrap" id="discover">
        <section className="intro-row"><div><div className="eyebrow"><span className="eyebrow-line" /> THE GOOD STUFF, RIGHT THIS WAY</div><h1>Find your <em>next</em><br />favorite film.</h1><p className="intro-copy">A little bit of everything, picked for your kind of night.</p></div><div className={`connection-status${loadError ? ' is-error' : ''}`}><span className="status-dot" />{isLoading ? 'Loading collection' : loadError ? 'Backend unavailable' : 'Connected to your collection'}</div></section>
        {featuredMovie && <section className="feature-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(18, 33, 29, .98) 0%, rgba(18, 33, 29, .88) 39%, rgba(18, 33, 29, .08) 100%), url("${featuredMovie.posterUrl || ''}")` }} aria-label="Featured film">
          <div className="feature-copy"><div className="feature-kicker"><span><Sparkles size={13} /></span> IN THE SPOTLIGHT <i /> FEATURED FILM</div><h2>{featuredMovie.title}</h2><div className="feature-meta"><span>{featuredMovie.year}</span><i /><span>{featuredMovie.genres.slice(0, 2).join(' / ') || 'FEATURED'}</span><i /><span className="feature-rating"><Star size={13} fill="currentColor" /> {featuredMovie.rating.toFixed(1)}</span></div><p>{featuredMovie.plot || 'A story worth staying in for.'}</p><button className="feature-button" onClick={() => openMovie(featuredMovie)} type="button"><Play size={15} fill="currentColor" /> Explore film</button></div><span className="feature-index">01 <i /> {String(pagination.total).padStart(2, '0')}</span>
        </section>}
        <section className="catalog-section" aria-label="Movie catalog">
          <div className="catalog-heading"><div><div className="eyebrow small-eyebrow">A GOOD PLACE TO START</div><h2>{showWatchlist ? 'Your watchlist' : search ? 'Search results' : activeGenre === 'All films' ? 'A little of everything' : `${activeGenre}, for you`}</h2></div><div className="catalog-controls"><span className="result-count">{pagination.total} FILMS</span><label className={`sort-control${sortByRating ? ' is-active' : ''}`}><SlidersHorizontal aria-hidden="true" size={15} /><select aria-label="Sort films" className="sort-select" onChange={(event) => setSortByRating(event.target.value === 'rating')} value={sortByRating ? 'rating' : 'recent'}><option value="recent">Recently added</option><option value="rating">Top rated</option></select></label></div></div>
          <div className="genre-pills" aria-label="Filter movies by genre">{['All films', ...genres].map((genre) => <button aria-pressed={activeGenre === genre} className={`genre-pill${activeGenre === genre ? ' is-active' : ''}`} key={genre} onClick={() => { setActiveGenre(genre); setShowWatchlist(false) }} type="button">{genre}</button>)}</div>
          {genresError && <p className="genre-error" role="alert">{genresError}</p>}
          {filteredMovies.length > 0 ? <><div className="movie-grid">{filteredMovies.map((movie, index) => {
            const isSaved = savedMovies.includes(movie.id)
            return <article className="movie-card" key={movie.id} style={{ animationDelay: `${index * 55}ms` }}>
              <button className="poster-button" onClick={() => openMovie(movie)} type="button" aria-label={`View ${movie.title}`}>
                {movie.posterUrl ? <img className="poster-image" src={movie.posterUrl} alt={`${movie.title} film still`} loading="lazy" /> : <div className="poster-placeholder"><Film size={32} /><span>{movie.title}</span></div>}
                <span className="poster-overlay"><span><Play size={15} fill="currentColor" /> View film</span></span><span className="poster-rating"><Star size={12} fill="currentColor" /> {movie.rating.toFixed(1)}</span>
              </button>
              <div className="movie-info"><div className="movie-title-row"><button className="movie-title" onClick={() => openMovie(movie)} type="button">{movie.title}</button><button aria-label={isSaved ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`} aria-pressed={isSaved} className={`save-button${isSaved ? ' saved' : ''}`} onClick={() => toggleSaved(movie.id)} type="button">{isSaved ? <Check size={15} /> : <Bookmark size={15} />}</button></div><div className="movie-subline"><span>{movie.year || '—'}</span><i />{movie.genres.slice(0, 2).join(' · ')}</div></div>
            </article>
          })}</div>{pagination.pages > 1 && <nav className="pagination-controls" aria-label="Movie pages">
            <button className="page-button" disabled={!pagination.hasPrevPage || isLoading} onClick={() => setPage(pagination.page - 1)} type="button">Previous</button>
            <span>Page {pagination.page} of {pagination.pages}</span>
            <button className="page-button" disabled={!pagination.hasNextPage || isLoading} onClick={() => setPage(pagination.page + 1)} type="button">Next</button>
          </nav>}</> : <div className="empty-state"><Search size={22} /><strong>{isLoading ? 'Loading films' : loadError ? 'Could not load films' : showWatchlist ? 'Your watchlist is empty' : 'No films found'}</strong><span>{isLoading ? 'Connecting to your collection...' : loadError ? loadError : 'Try another title or clear the genre filter.'}</span>{loadError && <button className="sort-button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }} type="button">Try again</button>}</div>}
        </section>
        <footer className="page-footer"><span>MOSAIC <i /> FILM, FOUND.</span><span>MADE FOR THE LOVE OF A GOOD STORY</span></footer>
    {selectedMovie && <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedMovie(null)}>
      <section aria-labelledby="detail-title" aria-modal="true" className="detail-dialog" role="dialog">
        <button aria-label="Close film details" className="dialog-close" onClick={() => setSelectedMovie(null)} type="button"><X size={20} /></button>
        <div className="detail-hero" style={{ backgroundImage: selectedMovie.posterUrl ? `linear-gradient(0deg, rgba(18, 25, 23, .97), rgba(18, 25, 23, .1)), url("${selectedMovie.posterUrl}")` : undefined }}><span className="detail-tag"><Film size={13} /> FILM DETAILS</span><h2 id="detail-title">{selectedMovie.title}</h2><div className="detail-meta"><span>{selectedMovie.year}</span><i />{selectedMovie.runtime ? `${selectedMovie.runtime} min` : 'Feature film'}<i /><span className="detail-rating"><Star size={13} fill="currentColor" /> {selectedMovie.rating.toFixed(1)}</span></div></div>
        <div className="detail-body"><div className="detail-description"><div className="detail-section-label">THE STORY</div><p>{selectedMovie.plot || 'No synopsis is available for this film yet.'}</p><div className="film-facts"><div><span>DIRECTOR</span><strong>{selectedMovie.director || 'Not listed'}</strong></div><div><span>GENRE</span><strong>{selectedMovie.genres.join(', ') || 'Not listed'}</strong></div><div><span>STARRING</span><strong>{selectedMovie.cast.join(', ') || 'Not listed'}</strong></div></div></div>
          <div className="comments-panel"><div className="comments-heading"><div><div className="detail-section-label">AFTER THE CREDITS</div><h3>Talk about it</h3></div><span><MessageCircle size={14} /> {comments.length}</span></div>
            <form className="comment-form" onSubmit={submitComment}><input aria-label="Your name" maxLength={60} onChange={(event) => setCommentName(event.target.value)} placeholder="Your name" required value={commentName} /><textarea aria-label="Your comment" maxLength={1000} onChange={(event) => setCommentText(event.target.value)} placeholder="What stayed with you?" required rows={3} value={commentText} />{commentError && <p className="comment-error" role="alert">{commentError}</p>}<button className="comment-submit" disabled={commentLoading} type="submit">{commentLoading ? 'Posting...' : 'Post comment'} <Send size={14} /></button></form>
            <div className="comment-list">{comments.length ? comments.map((comment) => <article className="comment-item" key={comment.id}><div className="comment-avatar">{comment.name.slice(0, 1).toUpperCase()}</div><div><div className="comment-author">{comment.name}<time>{comment.date ? new Date(comment.date).toLocaleDateString() : 'Just now'}</time></div><p>{comment.text}</p></div></article>) : <div className="no-comments"><Heart size={17} /> Be the first to leave a thought.</div>}</div>
          </div>
        </div>
      </section>
    </div>}
  </div>
}

export default DiscoverPage