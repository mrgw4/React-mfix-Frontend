import { useEffect, useState, type FormEvent } from 'react'
import { Bookmark, Check, Clapperboard, Film, Heart, MessageCircle, Play, Search, Send, SlidersHorizontal, Sparkles, Star, X } from 'lucide-react'
import { createComment, getComments, getMovies, type Movie, type MovieComment } from './api'
import './App.css'

const demoMovies: Movie[] = [
  { id: 'demo-1', title: 'The Quiet Between', year: 2025, genres: ['Drama', 'Mystery'], rating: 8.7, runtime: 114, plot: 'A sound archivist returns to her island home and finds a voice hidden in a recording made decades ago.', director: 'Mara Ellison', cast: ['Nina Park', 'Elias Reed', 'June Okafor'], posterUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=900&q=85' },
  { id: 'demo-2', title: 'After the Orchard', year: 2024, genres: ['Drama', 'Romance'], rating: 8.2, runtime: 103, plot: 'Two estranged siblings spend one last summer caring for the place they grew up.', director: 'Theo Mercer', cast: ['Rae Lin', 'Samir Patel'], posterUrl: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=900&q=85' },
  { id: 'demo-3', title: 'A Map of Small Things', year: 2025, genres: ['Adventure', 'Comedy'], rating: 7.9, runtime: 98, plot: 'A meticulous cartographer and a chaotic street musician take the long way across the city.', director: 'Inez Flores', cast: ['Milo Hart', 'Asha Bell'], posterUrl: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85' },
  { id: 'demo-4', title: 'Night Shift at the End', year: 2023, genres: ['Thriller', 'Sci-Fi'], rating: 8.1, runtime: 121, plot: 'On the final overnight shift at a remote observatory, the stars begin to disappear.', director: 'Caleb North', cast: ['Tess Morgan', 'Andre Cole'], posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=85' },
  { id: 'demo-5', title: 'The Shape of Sunday', year: 2024, genres: ['Comedy', 'Drama'], rating: 7.6, runtime: 107, plot: 'One neighborhood, three dinner parties, and a very misunderstood invitation.', director: 'Nico Alvarez', cast: ['Leah Brooks', 'Jon Bell'], posterUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=900&q=85' },
  { id: 'demo-6', title: 'Soft Focus', year: 2022, genres: ['Romance', 'Music'], rating: 7.8, runtime: 96, plot: 'A wedding photographer starts seeing the city differently through a borrowed camera.', director: 'Robin Wells', cast: ['Kit Avery', 'Luca James'], posterUrl: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85' },
]
const genres = ['All films', 'Drama', 'Mystery', 'Comedy', 'Adventure', 'Thriller', 'Romance']

function App() {
  const [movies, setMovies] = useState(demoMovies)
  const [usingDemo, setUsingDemo] = useState(true)
  const [search, setSearch] = useState('')
  const [activeGenre, setActiveGenre] = useState('All films')
  const [sortByRating, setSortByRating] = useState(false)
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [savedMovies, setSavedMovies] = useState<string[]>([])
  const [comments, setComments] = useState<MovieComment[]>([])
  const [commentName, setCommentName] = useState('')
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  useEffect(() => {
    let active = true
    getMovies().then((results) => {
      if (active) {
        setMovies(results.length ? results : demoMovies)
        setUsingDemo(results.length === 0)
      }
    }).catch(() => { if (active) setUsingDemo(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedMovie) return
    let active = true
    getComments(selectedMovie.id).then((results) => {
      if (active) setComments(results)
    }).catch(() => { if (active) setComments([]) })
    return () => { active = false }
  }, [selectedMovie])

  const filteredMovies = movies.filter((movie) => {
    const term = search.trim().toLowerCase()
    const matchesSearch = !term || [movie.title, movie.director, ...movie.genres].some((value) => value?.toLowerCase().includes(term))
    const matchesGenre = activeGenre === 'All films' || movie.genres.includes(activeGenre)
    const matchesWatchlist = !showWatchlist || savedMovies.includes(movie.id)
    return matchesSearch && matchesGenre && matchesWatchlist
  }).sort((first, second) => sortByRating ? second.rating - first.rating : second.year - first.year)
  const featuredMovie = movies[0]

  function toggleSaved(movieId: string) {
    setSavedMovies((current) => current.includes(movieId) ? current.filter((id) => id !== movieId) : [...current, movieId])
  }

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

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top" aria-label="Mosaic home"><span className="brand-mark"><Clapperboard size={20} /></span><span>mosaic<span className="brand-period">.</span></span></a>
      <div className="side-label">YOUR SPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        <a className="nav-link active" href="#discover"><Sparkles size={17} /> Discover</a>
        <button className="nav-link" onClick={() => { setSortByRating(true); setShowWatchlist(false) }} type="button"><Star size={17} /> Top rated</button>
        <button className={`nav-link${showWatchlist ? ' active' : ''}`} onClick={() => setShowWatchlist((current) => !current)} type="button"><Bookmark size={17} /> Watchlist <span className="nav-count">{savedMovies.length}</span></button>
      </nav>
      <div className="side-label genre-label">BROWSE BY MOOD</div>
      <nav className="genre-nav" aria-label="Browse by genre">
        {genres.slice(1).map((genre) => <button className={`genre-link${activeGenre === genre ? ' selected' : ''}`} key={genre} onClick={() => { setActiveGenre(activeGenre === genre ? 'All films' : genre); setShowWatchlist(false) }} type="button"><span className={`genre-dot dot-${genre.toLowerCase()}`} />{genre}</button>)}
      </nav>
      <div className="sidebar-note"><span className="note-icon"><Film size={16} /></span><p>Your next favorite is out there.</p><span>Keep looking.</span></div>
      <div className="profile-chip"><div className="profile-avatar">M</div><div><strong>Movie lover</strong><span>Guest profile</span></div><span className="profile-caret">⌄</span></div>
    </aside>

    <main id="top" className="main-content">
      <header className="topbar"><div className="breadcrumb"><span>YOUR SPACE</span><b>/</b> Discover</div><label className="search-box"><Search size={17} /><input aria-label="Search movies" onChange={(event) => setSearch(event.target.value)} placeholder="Find a film, director..." type="search" value={search} /><kbd>/</kbd></label><button className="avatar-small" type="button" aria-label="Guest profile">M</button></header>
      <div className="content-wrap" id="discover">
        <section className="intro-row"><div><div className="eyebrow"><span className="eyebrow-line" /> THE GOOD STUFF, RIGHT THIS WAY</div><h1>Find your <em>next</em><br />favorite film.</h1><p className="intro-copy">A little bit of everything, picked for your kind of night.</p></div><div className={`connection-status${usingDemo ? ' is-demo' : ''}`}><span className="status-dot" />{usingDemo ? 'Preview collection' : 'Connected to your collection'}</div></section>
        {featuredMovie && <section className="feature-banner" style={{ backgroundImage: `linear-gradient(90deg, rgba(18, 33, 29, .98) 0%, rgba(18, 33, 29, .88) 39%, rgba(18, 33, 29, .08) 100%), url("${featuredMovie.posterUrl || ''}")` }} aria-label="Featured film">
          <div className="feature-copy"><div className="feature-kicker"><span><Sparkles size={13} /></span> IN THE SPOTLIGHT <i /> FEATURED FILM</div><h2>{featuredMovie.title}</h2><div className="feature-meta"><span>{featuredMovie.year}</span><i /><span>{featuredMovie.genres.slice(0, 2).join(' / ') || 'FEATURED'}</span><i /><span className="feature-rating"><Star size={13} fill="currentColor" /> {featuredMovie.rating.toFixed(1)}</span></div><p>{featuredMovie.plot || 'A story worth staying in for.'}</p><button className="feature-button" onClick={() => openMovie(featuredMovie)} type="button"><Play size={15} fill="currentColor" /> Explore film</button></div><span className="feature-index">01 <i /> {String(movies.length).padStart(2, '0')}</span>
        </section>}
        <section className="catalog-section" aria-label="Movie catalog">
          <div className="catalog-heading"><div><div className="eyebrow small-eyebrow">A GOOD PLACE TO START</div><h2>{showWatchlist ? 'Your watchlist' : search ? 'Search results' : activeGenre === 'All films' ? 'A little of everything' : `${activeGenre}, for you`}</h2></div><div className="catalog-controls"><span className="result-count">{filteredMovies.length} FILMS</span><button aria-pressed={sortByRating} className={`sort-button${sortByRating ? ' is-active' : ''}`} onClick={() => setSortByRating((current) => !current)} type="button"><SlidersHorizontal size={15} /> {sortByRating ? 'Top rated' : 'Recently added'} <span>⌄</span></button></div></div>
          <div className="genre-pills" aria-label="Filter movies by genre">{genres.map((genre) => <button aria-pressed={activeGenre === genre} className={`genre-pill${activeGenre === genre ? ' is-active' : ''}`} key={genre} onClick={() => { setActiveGenre(genre); setShowWatchlist(false) }} type="button">{genre}</button>)}</div>
          {filteredMovies.length > 0 ? <div className="movie-grid">{filteredMovies.map((movie, index) => {
            const isSaved = savedMovies.includes(movie.id)
            return <article className="movie-card" key={movie.id} style={{ animationDelay: `${index * 55}ms` }}>
              <button className="poster-button" onClick={() => openMovie(movie)} type="button" aria-label={`View ${movie.title}`}>
                {movie.posterUrl ? <img className="poster-image" src={movie.posterUrl} alt={`${movie.title} film still`} loading="lazy" /> : <div className="poster-placeholder"><Film size={32} /><span>{movie.title}</span></div>}
                <span className="poster-overlay"><span><Play size={15} fill="currentColor" /> View film</span></span><span className="poster-rating"><Star size={12} fill="currentColor" /> {movie.rating.toFixed(1)}</span>
              </button>
              <div className="movie-info"><div className="movie-title-row"><button className="movie-title" onClick={() => openMovie(movie)} type="button">{movie.title}</button><button aria-label={isSaved ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`} aria-pressed={isSaved} className={`save-button${isSaved ? ' saved' : ''}`} onClick={() => toggleSaved(movie.id)} type="button">{isSaved ? <Check size={15} /> : <Bookmark size={15} />}</button></div><div className="movie-subline"><span>{movie.year || '—'}</span><i />{movie.genres.slice(0, 2).join(' · ')}</div></div>
            </article>
          })}</div> : <div className="empty-state"><Search size={22} /><strong>No films found</strong><span>Try another title or clear the genre filter.</span></div>}
        </section>
        <footer className="page-footer"><span>MOSAIC <i /> FILM, FOUND.</span><span>MADE FOR THE LOVE OF A GOOD STORY</span></footer>
      </div>
    </main>

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

export default App