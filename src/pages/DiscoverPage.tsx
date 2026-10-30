import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowDownUp,
  Bookmark,
  Check,
  Film,
  Heart,
  MessageCircle,
  Play,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import {
  createComment,
  getComments,
  getMovie,
  getMovies,
  type AdvancedMovieFilters,
  type Movie,
  type MovieComment,
  type MoviePage,
  type MovieSort,
  type MovieSortOrder,
} from '../api'
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
type AdvancedSearchDraft = {
  [Field in Exclude<keyof AdvancedMovieFilters, 'sort' | 'order'>]: string
}
const emptyAdvancedSearch: AdvancedSearchDraft = {
  title: '',
  plot: '',
  directors: '',
  cast: '',
  rated: '',
  type: '',
  yearMin: '',
  yearMax: '',
  runtimeMin: '',
  runtimeMax: '',
  imdbRatingMin: '',
  imdbRatingMax: '',
  metacriticMin: '',
  metacriticMax: '',
}

const movieSortOptions: { value: MovieSort; label: string }[] = [
  { value: 'year', label: 'Newest year' },
  { value: 'imdbRating', label: 'Top rated' },
  { value: 'title', label: 'Title' },
  { value: 'runtime', label: 'Runtime' },
  { value: 'released', label: 'Release date' },
  { value: 'metacritic', label: 'Metacritic score' },
]

type WatchlistFilterOptions = {
  search: string
  genres: string[]
  filters: AdvancedMovieFilters
}

function matchesText(value: string, filter: string) {
  return value.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())
}

function filterWatchlistMovies(movies: Movie[], options: WatchlistFilterOptions) {
  const search = options.search.trim()
  return movies.filter((movie) => {
    const searchableFields = [
      movie.title,
      ...movie.directors,
      ...movie.genres,
    ]
    if (search && !searchableFields.some((value) => matchesText(value, search))) return false
    if (!options.genres.every((genre) => movie.genres.includes(genre))) return false

    if (options.filters.title && !matchesText(movie.title, options.filters.title)) return false
    if (options.filters.plot && !matchesText(movie.plotForFiltering, options.filters.plot)) return false
    if (options.filters.directors && !movie.directors.includes(options.filters.directors)) return false
    if (options.filters.cast && !movie.cast.includes(options.filters.cast)) return false
    if (options.filters.rated && movie.rated !== options.filters.rated) return false
    if (options.filters.type && movie.type !== options.filters.type) return false

    const rangeFilters = [
      [movie.year, options.filters.yearMin, options.filters.yearMax],
      [movie.runtime, options.filters.runtimeMin, options.filters.runtimeMax],
      [movie.rating, options.filters.imdbRatingMin, options.filters.imdbRatingMax],
      [movie.metacritic, options.filters.metacriticMin, options.filters.metacriticMax],
    ] as const
    return rangeFilters.every(([value, minimum, maximum]) => {
      if (minimum === undefined && maximum === undefined) return true
      if (value === null) return false
      return (minimum === undefined || value >= minimum) && (maximum === undefined || value <= maximum)
    })
  })
}

function getMovieSortValue(
  movie: Movie,
  sort: NonNullable<AdvancedMovieFilters['sort']>,
): number | string {
  switch (sort) {
    case 'title':
      return movie.title.toLocaleLowerCase()
    case 'runtime':
      return movie.runtime
    case 'metacritic':
      return movie.metacritic ?? -1
    case 'released':
      return Date.parse(movie.released) || movie.year
    case 'imdbRating':
      return movie.rating
    case 'year':
    default:
      return movie.year
  }
}

function sortWatchlistMovies(movies: Movie[], filters: AdvancedMovieFilters, sortByRating: boolean) {
  const sort = filters.sort ?? (sortByRating ? 'imdbRating' : 'year')
  const direction = filters.sort ? filters.order ?? 'desc' : 'desc'

  return [...movies].sort((first, second) => {
    const firstValue = getMovieSortValue(first, sort)
    const secondValue = getMovieSortValue(second, sort)
    const bothValuesAreStrings = typeof firstValue === 'string' && typeof secondValue === 'string'
    const comparison = bothValuesAreStrings
      ? String(firstValue).localeCompare(String(secondValue))
      : Number(firstValue) - Number(secondValue)

    return direction === 'asc' ? comparison : -comparison
  })
}

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
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false)
  const [advancedSearchDraft, setAdvancedSearchDraft] = useState<AdvancedSearchDraft>(emptyAdvancedSearch)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedMovieFilters>({})
  const [advancedSearchError, setAdvancedSearchError] = useState('')
  const {
    search,
    genres,
    genresError,
    activeGenres,
    setActiveGenres,
    sortByRating,
    setSortByRating,
    showWatchlist,
    savedMovies,
    toggleSaved,
  } = useAppShell()
  const watchlistMovieCache = useRef(new Map<string, Movie>())
  const advancedFiltersKey = JSON.stringify(advancedFilters)
  const activeGenresKey = JSON.stringify(activeGenres)
  const previousFilters = useRef({
    search: debouncedSearch,
    activeGenresKey,
    sortByRating,
    showWatchlist,
    advancedFiltersKey,
  })
  const savedMoviesKey = showWatchlist ? savedMovies.join('\u001f') : ''

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let active = true
    const filters = { search: debouncedSearch, activeGenresKey, sortByRating, showWatchlist }
    const filtersChanged = filters.search !== previousFilters.current.search
      || filters.activeGenresKey !== previousFilters.current.activeGenresKey
      || filters.sortByRating !== previousFilters.current.sortByRating
      || filters.showWatchlist !== previousFilters.current.showWatchlist
      || advancedFiltersKey !== previousFilters.current.advancedFiltersKey
    previousFilters.current = { ...filters, advancedFiltersKey }
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
    const loadResults = showWatchlist
      ? Promise.all(
        watchlistIds
          .filter((movieId) => !watchlistMovieCache.current.has(movieId))
          .map(async (movieId) => {
            watchlistMovieCache.current.set(movieId, await getMovie(movieId))
          }),
      ).then(() => {
        const results = watchlistIds
          .map((movieId) => watchlistMovieCache.current.get(movieId))
          .filter((movie): movie is Movie => movie !== undefined)
        const filtered = sortWatchlistMovies(
          filterWatchlistMovies(results, {
            search: debouncedSearch,
            genres: activeGenres,
            filters: advancedFilters,
          }),
          advancedFilters,
          sortByRating,
        )
        const pages = Math.ceil(filtered.length / moviesPerPage)
        const watchlistPage = Math.min(page, Math.max(pages, 1))

        return {
          movies: filtered.slice(
            (watchlistPage - 1) * moviesPerPage,
            watchlistPage * moviesPerPage,
          ),
          pagination: {
            page: watchlistPage,
            limit: moviesPerPage,
            total: filtered.length,
            pages,
            hasNextPage: watchlistPage < pages,
            hasPrevPage: watchlistPage > 1,
          },
        }
      })
      : getMovies({
        page,
        genres: activeGenres,
        search: debouncedSearch,
        sortByRating,
        ...advancedFilters,
      })

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
  }, [
    page,
    debouncedSearch,
    activeGenres,
    activeGenresKey,
    sortByRating,
    showWatchlist,
    savedMoviesKey,
    reloadKey,
    advancedFilters,
    advancedFiltersKey,
  ])

  useEffect(() => {
    if (!selectedMovie) return
    let active = true
    getComments(selectedMovie.id)
      .then((results) => {
      if (active) setComments(results)
      })
      .catch(() => {
        if (active) setComments([])
      })
    return () => {
      active = false
    }
  }, [selectedMovie])

  const filteredMovies = movies
  const featuredMovie = movies[0]
  const featuredMovieBannerStyle = useMemo(() => ({
    backgroundImage: featuredMovie
      ? `linear-gradient(90deg, rgba(18, 33, 29, .98) 0%, rgba(18, 33, 29, .88) 39%, rgba(18, 33, 29, .08) 100%), url("${featuredMovie.posterUrl || ''}")`
      : undefined,
  }), [featuredMovie])
  const hasAdvancedFilters = Object.keys(advancedFilters).some((key) => key !== 'sort' && key !== 'order')
  const catalogTitle = showWatchlist
    ? 'Your watchlist'
    : search || hasAdvancedFilters
      ? 'Search results'
      : activeGenres.length === 0
        ? 'A little of everything'
        : `${activeGenres.join(' + ')}, for you`
  const selectedSort = advancedFilters.sort ?? (sortByRating ? 'imdbRating' : 'year')
  const selectedSortOrder = advancedFilters.order ?? 'desc'

  function updateMovieSort(value: string) {
    const option = movieSortOptions.find((sortOption) => sortOption.value === value)
    if (!option) return
    const sort: MovieSort = option.value
    setSortByRating(sort === 'imdbRating')
    setAdvancedFilters((current) => ({ ...current, sort }))
  }

  function updateSortOrder(value: string) {
    if (value !== 'asc' && value !== 'desc') return
    const order: MovieSortOrder = value
    setAdvancedFilters((current) => ({ ...current, order }))
  }

  function openMovie(movie: Movie) {
    setComments([])
    setCommentError('')
    setSelectedMovie(movie)
  }

  function updateAdvancedSearchField(field: keyof AdvancedSearchDraft, value: string) {
    setAdvancedSearchDraft((current) => ({ ...current, [field]: value }))
  }

  function submitAdvancedSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ranges = [
      ['yearMin', 'yearMax', 'Minimum year must be no greater than maximum year.'],
      ['runtimeMin', 'runtimeMax', 'Minimum runtime must be no greater than maximum runtime.'],
      ['imdbRatingMin', 'imdbRatingMax', 'Minimum IMDb rating must be no greater than maximum rating.'],
      ['metacriticMin', 'metacriticMax', 'Minimum Metacritic score must be no greater than maximum score.'],
    ] as const
    for (const [minimumKey, maximumKey, message] of ranges) {
      const minimum = advancedSearchDraft[minimumKey]
      const maximum = advancedSearchDraft[maximumKey]
      if (minimum && maximum && Number(minimum) > Number(maximum)) {
        setAdvancedSearchError(message)
        return
      }
    }

    const filters: AdvancedMovieFilters = {
      sort: advancedFilters.sort ?? (sortByRating ? 'imdbRating' : 'year'),
      order: advancedFilters.order ?? 'desc',
    }
    for (const field of ['title', 'plot', 'directors', 'cast', 'rated', 'type'] as const) {
      const value = advancedSearchDraft[field].trim()
      if (value) filters[field] = value
    }
    for (const field of ['yearMin', 'yearMax', 'runtimeMin', 'runtimeMax', 'imdbRatingMin', 'imdbRatingMax', 'metacriticMin', 'metacriticMax'] as const) {
      const value = advancedSearchDraft[field]
      if (value) filters[field] = Number(value)
    }
    setAdvancedSearchError('')
    setAdvancedFilters(filters)
    setPage(1)
  }

  function clearAdvancedSearch() {
    setAdvancedSearchDraft(emptyAdvancedSearch)
    setAdvancedSearchError('')
    setAdvancedFilters((current) => ({
      sort: current.sort,
      order: current.order,
    }))
    setPage(1)
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedMovie || !commentName.trim() || !commentText.trim()) return
    setCommentLoading(true)
    setCommentError('')
    try {
      const created = await createComment({
        movieId: selectedMovie.id,
        name: commentName.trim(),
        text: commentText.trim(),
      })
      setComments((current) => [created, ...current])
      setCommentText('')
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : 'Could not post your comment.')
    } finally {
      setCommentLoading(false)
    }
  }

  return <div className="content-wrap" id="discover">
    <section className="intro-row">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-line" />
          THE GOOD STUFF, RIGHT THIS WAY
        </div>
        <h1>
          Find your <em>next</em>
          <br />
          favorite film.
        </h1>
        <p className="intro-copy">A little bit of everything, picked for your kind of night.</p>
      </div>
      <div className={`connection-status${loadError ? ' is-error' : ''}`}>
        <span className="status-dot" />
        {isLoading
          ? 'Loading collection'
          : loadError
            ? 'Backend unavailable'
            : 'Connected to your collection'}
      </div>
    </section>

    {featuredMovie && (
      <section
        aria-label="Featured film"
        className="feature-banner"
        style={featuredMovieBannerStyle}
      >
        <div className="feature-copy">
          <div className="feature-kicker">
            <span><Sparkles size={13} /></span>
            IN THE SPOTLIGHT <i /> FEATURED FILM
          </div>
          <h2>{featuredMovie.title}</h2>
          <div className="feature-meta">
            <span>{featuredMovie.year}</span>
            <i />
            <span>
              {featuredMovie.genres.slice(0, 2).join(' / ')
                || <span className="feature-fallback">FEATURED</span>}
            </span>
            <i />
            <span className="feature-rating">
              <Star size={13} fill="currentColor" />
              {featuredMovie.rating.toFixed(1)}
            </span>
          </div>
          <p>{featuredMovie.plot || 'A story worth staying in for.'}</p>
          <button
            className="feature-button"
            onClick={() => openMovie(featuredMovie)}
            type="button"
          >
            <Play size={15} fill="currentColor" />
            Explore film
          </button>
        </div>
        <span className="feature-index">
          01 <i /> {String(pagination.total).padStart(2, '0')}
        </span>
      </section>
    )}

    <section aria-label="Movie catalog" className="catalog-section">
      <div className="catalog-heading">
        <div>
          <div className="eyebrow small-eyebrow">A GOOD PLACE TO START</div>
          <h2>{catalogTitle}</h2>
        </div>
        <div className="catalog-controls">
          <span className="result-count">{pagination.total} FILMS</span>
          <div
            aria-label="Catalog search and sort"
            className="catalog-control-actions"
            role="group"
          >
            <button
              aria-controls="advanced-search-panel"
              aria-expanded={advancedSearchOpen}
              className={`advanced-search-toggle${advancedSearchOpen ? ' is-open' : ''}`}
              onClick={() => setAdvancedSearchOpen((open) => !open)}
              type="button"
            >
              <SlidersHorizontal aria-hidden="true" size={14} />
              Advanced search
            </button>
            <label className="sort-control">
              <ArrowDownUp aria-hidden="true" size={15} />
              <select
                aria-label="Sort films"
                className="sort-select"
                onChange={(event) => updateMovieSort(event.target.value)}
                value={selectedSort}
              >
                {movieSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="sort-control">
              <select
                aria-label="Sort direction"
                className="sort-select"
                onChange={(event) => updateSortOrder(event.target.value)}
                value={selectedSortOrder}
              >
                <option value="desc">Highest / newest first</option>
                <option value="asc">Lowest / oldest first</option>
              </select>
            </label>
          </div>
          {hasAdvancedFilters && (
            <span className="advanced-search-active">Advanced filters applied</span>
          )}
        </div>
      </div>

      <div aria-label="Filter movies by genre" className="genre-pills">
        {['All films', ...genres].map((genre) => {
          const selected = genre === 'All films'
            ? activeGenres.length === 0
            : activeGenres.includes(genre)

          function toggleGenre() {
            if (genre === 'All films') {
              setActiveGenres([])
              return
            }

            setActiveGenres((current) => current.includes(genre)
              ? current.filter((selectedGenre) => selectedGenre !== genre)
              : [...current, genre])
          }

          return (
            <button
              aria-pressed={selected}
              className={`genre-pill${selected ? ' is-active' : ''}`}
              key={genre}
              onClick={toggleGenre}
              type="button"
            >
              {genre}
            </button>
          )
        })}
      </div>

      {advancedSearchOpen && (
        <form
          className="advanced-search-panel"
          id="advanced-search-panel"
          onSubmit={submitAdvancedSearch}
        >
          <div className="advanced-search-heading">
            <div>
              <strong>Find a film by its details</strong>
              <span>Filters are matched against the complete movie collection.</span>
            </div>
            <button
              className="advanced-search-clear"
              onClick={clearAdvancedSearch}
              type="button"
            >
              Clear filters
            </button>
          </div>

          <div className="advanced-search-fields">
            <label className="advanced-search-field">
              Title
              <input
                maxLength={150}
                onChange={(event) => updateAdvancedSearchField('title', event.target.value)}
                placeholder="Film title"
                value={advancedSearchDraft.title}
              />
            </label>
            <label className="advanced-search-field">
              Plot
              <input
                maxLength={200}
                onChange={(event) => updateAdvancedSearchField('plot', event.target.value)}
                placeholder="Story or subject"
                value={advancedSearchDraft.plot}
              />
            </label>
            <label className="advanced-search-field">
              Director
              <input
                maxLength={100}
                onChange={(event) => updateAdvancedSearchField('directors', event.target.value)}
                placeholder="Director name"
                value={advancedSearchDraft.directors}
              />
            </label>
            <label className="advanced-search-field">
              Cast member
              <input
                maxLength={100}
                onChange={(event) => updateAdvancedSearchField('cast', event.target.value)}
                placeholder="Actor name"
                value={advancedSearchDraft.cast}
              />
            </label>
            <label className="advanced-search-field">
              Content rating
              <input
                maxLength={20}
                onChange={(event) => updateAdvancedSearchField('rated', event.target.value)}
                placeholder="e.g. PG-13"
                value={advancedSearchDraft.rated}
              />
            </label>
            <label className="advanced-search-field">
              Movie type
              <input
                maxLength={30}
                onChange={(event) => updateAdvancedSearchField('type', event.target.value)}
                placeholder="e.g. movie"
                value={advancedSearchDraft.type}
              />
            </label>

            <fieldset className="advanced-search-range">
              <legend>Release year</legend>
              <label>
                From
                <input
                  aria-label="Release year from"
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => updateAdvancedSearchField('yearMin', event.target.value)}
                  step="1"
                  type="number"
                  value={advancedSearchDraft.yearMin}
                />
              </label>
              <label>
                To
                <input
                  aria-label="Release year to"
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => updateAdvancedSearchField('yearMax', event.target.value)}
                  step="1"
                  type="number"
                  value={advancedSearchDraft.yearMax}
                />
              </label>
            </fieldset>
            <fieldset className="advanced-search-range">
              <legend>Runtime (minutes)</legend>
              <label>
                Min
                <input
                  aria-label="Minimum runtime"
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => updateAdvancedSearchField('runtimeMin', event.target.value)}
                  step="1"
                  type="number"
                  value={advancedSearchDraft.runtimeMin}
                />
              </label>
              <label>
                Max
                <input
                  aria-label="Maximum runtime"
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => updateAdvancedSearchField('runtimeMax', event.target.value)}
                  step="1"
                  type="number"
                  value={advancedSearchDraft.runtimeMax}
                />
              </label>
            </fieldset>
            <fieldset className="advanced-search-range">
              <legend>IMDb rating (0–10)</legend>
              <label>
                Min
                <input
                  aria-label="Minimum IMDb rating"
                  max="10"
                  min="0"
                  onChange={(event) => updateAdvancedSearchField('imdbRatingMin', event.target.value)}
                  step="0.1"
                  type="number"
                  value={advancedSearchDraft.imdbRatingMin}
                />
              </label>
              <label>
                Max
                <input
                  aria-label="Maximum IMDb rating"
                  max="10"
                  min="0"
                  onChange={(event) => updateAdvancedSearchField('imdbRatingMax', event.target.value)}
                  step="0.1"
                  type="number"
                  value={advancedSearchDraft.imdbRatingMax}
                />
              </label>
            </fieldset>
            <fieldset className="advanced-search-range">
              <legend>Metacritic score (0–100)</legend>
              <label>
                Min
                <input
                  aria-label="Minimum Metacritic score"
                  max="100"
                  min="0"
                  onChange={(event) => updateAdvancedSearchField('metacriticMin', event.target.value)}
                  step="1"
                  type="number"
                  value={advancedSearchDraft.metacriticMin}
                />
              </label>
              <label>
                Max
                <input
                  aria-label="Maximum Metacritic score"
                  max="100"
                  min="0"
                  onChange={(event) => updateAdvancedSearchField('metacriticMax', event.target.value)}
                  step="1"
                  type="number"
                  value={advancedSearchDraft.metacriticMax}
                />
              </label>
            </fieldset>

          </div>

          {advancedSearchError && (
            <p className="advanced-search-error" role="alert">{advancedSearchError}</p>
          )}
          <div className="advanced-search-actions">
            <button className="advanced-search-submit" type="submit">Apply filters</button>
          </div>
        </form>
      )}

      {genresError && <p className="genre-error" role="alert">{genresError}</p>}
      {filteredMovies.length > 0 ? (
        <>
          <div className="movie-grid">
            {filteredMovies.map((movie, index) => {
              const isSaved = savedMovies.includes(movie.id)

              return (
                <article
                  className="movie-card"
                  key={movie.id}
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <button
                    aria-label={`View ${movie.title}`}
                    className="poster-button"
                    onClick={() => openMovie(movie)}
                    type="button"
                  >
                    {movie.posterUrl ? (
                      <img
                        alt={`${movie.title} film still`}
                        className="poster-image"
                        loading="lazy"
                        src={movie.posterUrl}
                      />
                    ) : (
                      <div className="poster-placeholder">
                        <Film size={32} />
                        <span>{movie.title}</span>
                      </div>
                    )}
                    <span className="poster-overlay">
                      <span><Play size={15} fill="currentColor" /> View film</span>
                    </span>
                    <span className="poster-rating">
                      <Star size={12} fill="currentColor" />
                      {movie.rating.toFixed(1)}
                    </span>
                  </button>

                  <div className="movie-info">
                    <div className="movie-title-row">
                      <button
                        className="movie-title"
                        onClick={() => openMovie(movie)}
                        type="button"
                      >
                        {movie.title}
                      </button>
                      <button
                        aria-label={isSaved
                          ? `Remove ${movie.title} from watchlist`
                          : `Add ${movie.title} to watchlist`}
                        aria-pressed={isSaved}
                        className={`save-button${isSaved ? ' saved' : ''}`}
                        onClick={() => toggleSaved(movie.id)}
                        type="button"
                      >
                        {isSaved ? <Check size={15} /> : <Bookmark size={15} />}
                      </button>
                    </div>
                    <div className="movie-subline">
                      <span>{movie.year || '—'}</span>
                      <i />
                      {movie.genres.slice(0, 2).join(' · ')}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {pagination.pages > 1 && (
            <nav aria-label="Movie pages" className="pagination-controls">
              <button
                className="page-button"
                disabled={!pagination.hasPrevPage || isLoading}
                onClick={() => setPage(pagination.page - 1)}
                type="button"
              >
                Previous
              </button>
              <span>Page {pagination.page} of {pagination.pages}</span>
              <button
                className="page-button"
                disabled={!pagination.hasNextPage || isLoading}
                onClick={() => setPage(pagination.page + 1)}
                type="button"
              >
                Next
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="empty-state">
          <Search size={22} />
          <strong>
            {isLoading
              ? 'Loading films'
              : loadError
                ? 'Could not load films'
                : showWatchlist
                  ? savedMovies.length
                    ? 'No watchlist films match'
                    : 'Your watchlist is empty'
                  : 'No films found'}
          </strong>
          <span>
            {isLoading
              ? 'Connecting to your collection...'
              : loadError
                ? loadError
                : showWatchlist
                  ? 'Try changing or clearing your filters.'
                  : 'Try another title or clear the genre filter.'}
          </span>
          {loadError && (
            <button
              className="sort-button"
              onClick={() => {
                setIsLoading(true)
                setReloadKey((key) => key + 1)
              }}
              type="button"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </section>

    <footer className="page-footer">
      <span>MOSAIC <i /> FILM, FOUND.</span>
      <span>MADE FOR THE LOVE OF A GOOD STORY</span>
    </footer>

    {selectedMovie && (
      <div
        className="dialog-backdrop"
        onMouseDown={(event) => event.target === event.currentTarget && setSelectedMovie(null)}
      >
        <section
          aria-labelledby="detail-title"
          aria-modal="true"
          className="detail-dialog"
          role="dialog"
        >
          <button
            aria-label="Close film details"
            className="dialog-close"
            onClick={() => setSelectedMovie(null)}
            type="button"
          >
            <X size={20} />
          </button>
          <div
            className="detail-hero"
            style={{
              backgroundImage: selectedMovie.posterUrl
                ? `linear-gradient(0deg, rgba(18, 25, 23, .97), rgba(18, 25, 23, .1)), url("${selectedMovie.posterUrl}")`
                : undefined,
            }}
          >
            <span className="detail-tag"><Film size={13} /> FILM DETAILS</span>
            <h2 id="detail-title">{selectedMovie.title}</h2>
            <div className="detail-meta">
              <span>{selectedMovie.year}</span>
              <i />
              {selectedMovie.runtime ? `${selectedMovie.runtime} min` : 'Feature film'}
              <i />
              <span className="detail-rating">
                <Star size={13} fill="currentColor" />
                {selectedMovie.rating.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="detail-body">
            <div className="detail-description">
              <div className="detail-section-label">THE STORY</div>
              <p>{selectedMovie.plot || 'No synopsis is available for this film yet.'}</p>
              <div className="film-facts">
                <div>
                  <span>DIRECTOR</span>
                  <strong>{selectedMovie.director || 'Not listed'}</strong>
                </div>
                <div>
                  <span>GENRE</span>
                  <strong>{selectedMovie.genres.join(', ') || 'Not listed'}</strong>
                </div>
                <div>
                  <span>STARRING</span>
                  <strong>{selectedMovie.cast.join(', ') || 'Not listed'}</strong>
                </div>
              </div>
            </div>

            <div className="comments-panel">
              <div className="comments-heading">
                <div>
                  <div className="detail-section-label">AFTER THE CREDITS</div>
                  <h3>Talk about it</h3>
                </div>
                <span><MessageCircle size={14} /> {comments.length}</span>
              </div>

              <form className="comment-form" onSubmit={submitComment}>
                <input
                  aria-label="Your name"
                  maxLength={60}
                  onChange={(event) => setCommentName(event.target.value)}
                  placeholder="Your name"
                  required
                  value={commentName}
                />
                <textarea
                  aria-label="Your comment"
                  maxLength={1000}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="What stayed with you?"
                  required
                  rows={3}
                  value={commentText}
                />
                {commentError && <p className="comment-error" role="alert">{commentError}</p>}
                <button
                  className="comment-submit"
                  disabled={commentLoading}
                  type="submit"
                >
                  {commentLoading ? 'Posting...' : 'Post comment'}
                  <Send size={14} />
                </button>
              </form>

              <div className="comment-list">
                {comments.length ? (
                  comments.map((comment) => (
                    <article className="comment-item" key={comment.id}>
                      <div className="comment-avatar">
                        {comment.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="comment-author">
                          {comment.name}
                          <time>
                            {comment.date
                              ? new Date(comment.date).toLocaleDateString()
                              : 'Just now'}
                          </time>
                        </div>
                        <p>{comment.text}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="no-comments">
                    <Heart size={17} />
                    Be the first to leave a thought.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    )}
  </div>
}

export default DiscoverPage