import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

const movieResponse = {
  data: [{
    _id: 'movie-123',
    title: 'The Quiet Between',
    year: 2025,
    genres: ['Drama', 'Mystery'],
    imdb: { rating: 8.7 },
    runtime: 114,
    fullplot: 'A story from the backend.',
    directors: ['Mara Ellison'],
    cast: ['Nina Park'],
    poster: '',
  }],
  pagination: { page: 1, limit: 30, total: 1, pages: 1, hasNextPage: false, hasPrevPage: false },
}
const genresResponse = { genres: ['Drama', 'Mystery', 'Documentary'] }

describe('movie discovery integration', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      return {
        ok: true,
        json: async () => url.pathname.endsWith('/genres')
          ? genresResponse
          : url.pathname === '/api/movies' ? movieResponse : movieResponse.data[0],
      }
    }))
  })

  it('excludes watchlist films with a missing Metacritic score from score ranges', async () => {
    const movieWithoutScore = { ...movieResponse.data[0], _id: 'no-score', title: 'No score', metacritic: null }
    window.localStorage.setItem('mosaic.watchlist.v1', JSON.stringify(['no-score']))
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      return {
        ok: true,
        json: async () => url.pathname.endsWith('/genres') ? genresResponse
          : url.pathname === '/api/movies' ? movieResponse
            : movieWithoutScore,
      }
    }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Watchlist/ }))
    await screen.findByRole('button', { name: 'No score' })
    await user.click(screen.getByRole('button', { name: 'Advanced search' }))
    await user.type(screen.getByLabelText('Minimum Metacritic score'), '0')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(await screen.findByText('No watchlist films match')).toBeVisible()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads movies from the backend response', async () => {
    render(<App />)

    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Documentary' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Connected to your collection')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/movies?'), expect.objectContaining({}))
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/movies/genres'), expect.objectContaining({}))
  })

  it('requests a selected genre from the backend, including genres outside the first page', async () => {
    const documentaryResponse = {
      ...movieResponse,
      data: [{ ...movieResponse.data[0], _id: 'documentary-1', title: 'A Distant Voice', genres: ['Documentary'] }],
    }
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const body = url.pathname.endsWith('/genres')
        ? genresResponse
        : url.searchParams.get('genres') === 'Documentary' ? documentaryResponse : movieResponse
      return { ok: true, json: async () => body }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: 'Documentary' })[0])

    expect(await screen.findByRole('button', { name: 'A Distant Voice' })).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/[?&]genres=Documentary/),
      expect.objectContaining({}),
    )
  })

  it('combines multiple selected genre pills with an AND filter', async () => {
    const combinedResponse = {
      ...movieResponse,
      data: [{
        ...movieResponse.data[0],
        _id: 'combined-genre-movie',
        title: 'Drama and Mystery',
      }],
    }
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const body = url.pathname.endsWith('/genres')
        ? genresResponse
        : url.searchParams.get('genres') === 'Drama,Mystery' ? combinedResponse : movieResponse
      return { ok: true, json: async () => body }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    const genrePills = within(screen.getByLabelText('Filter movies by genre'))
    await user.click(genrePills.getByRole('button', { name: 'Drama' }))
    await user.click(genrePills.getByRole('button', { name: 'Mystery' }))

    expect(await screen.findByRole('button', { name: 'Drama and Mystery' })).toBeVisible()
    expect(genrePills.getByRole('button', { name: 'Drama' })).toHaveAttribute('aria-pressed', 'true')
    expect(genrePills.getByRole('button', { name: 'Mystery' })).toHaveAttribute('aria-pressed', 'true')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/[?&]genres=Drama%2CMystery/),
      expect.objectContaining({}),
    )
    await user.click(genrePills.getByRole('button', { name: 'Drama' }))
    expect(genrePills.getByRole('button', { name: 'Drama' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(genrePills.getByRole('button', { name: 'All films' }))
    expect(genrePills.getByRole('button', { name: 'All films' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('selects the active sort order and requests the matching movie sort', async () => {
    const user = userEvent.setup()
    render(<App />)

    const sortSelect = await screen.findByRole('combobox', { name: 'Sort films' })
    expect(sortSelect).toHaveValue('year')

    await user.selectOptions(sortSelect, 'imdbRating')

    expect(sortSelect).toHaveValue('imdbRating')
    expect(screen.getByRole('heading', { name: 'A little of everything' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/[?&]sort=imdbRating/),
      expect.objectContaining({}),
    )

    await user.selectOptions(sortSelect, 'year')

    expect(sortSelect).toHaveValue('year')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/[?&]sort=year/),
      expect.objectContaining({}),
    )
  })

  it('applies advanced movie criteria to backend search requests', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      return {
        ok: true,
        json: async () => url.pathname.endsWith('/genres') ? genresResponse : movieResponse,
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    const catalogControls = within(screen.getByRole('group', { name: 'Catalog search and sort' }))
    const sortSelect = catalogControls.getByRole('combobox', { name: 'Sort films' })
    const sortOrderSelect = catalogControls.getByRole('combobox', { name: 'Sort direction' })
    await user.click(screen.getByRole('button', { name: 'Advanced search' }))
    await user.type(screen.getByLabelText('Title'), 'Quiet')
    await user.type(screen.getByLabelText('Release year from'), '2020')
    await user.type(screen.getByLabelText('Minimum IMDb rating'), '8')
    await user.selectOptions(sortSelect, 'imdbRating')
    await user.selectOptions(sortOrderSelect, 'asc')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    const advancedRequest = fetchMock.mock.calls
      .map(([input]) => new URL(String(input)))
      .find((url) => url.pathname === '/api/movies' && url.searchParams.has('title'))
    expect(advancedRequest?.searchParams.get('title')).toBe('Quiet')
    expect(advancedRequest?.searchParams.get('yearMin')).toBe('2020')
    expect(advancedRequest?.searchParams.get('imdbRatingMin')).toBe('8')
    expect(advancedRequest?.searchParams.get('sort')).toBe('imdbRating')
    expect(advancedRequest?.searchParams.get('order')).toBe('asc')
    expect(screen.getByText('Advanced filters applied')).toBeInTheDocument()
    expect(sortSelect).toHaveValue('imdbRating')
    expect(sortOrderSelect).toHaveValue('asc')

    await user.selectOptions(sortSelect, 'year')
    await waitFor(() => {
      const sortedRequest = fetchMock.mock.calls
        .map(([input]) => new URL(String(input)))
        .find((url) => url.pathname === '/api/movies' && url.searchParams.has('title')
          && url.searchParams.get('sort') === 'year')
      expect(sortedRequest?.searchParams.get('order')).toBe('asc')
    })
    expect(sortSelect).toHaveValue('year')
  })

  it('prevents advanced searches with an inverted year range', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('button', { name: 'The Quiet Between' })
    await user.click(screen.getByRole('button', { name: 'Advanced search' }))
    await user.type(screen.getByLabelText('Release year from'), '2025')
    await user.type(screen.getByLabelText('Release year to'), '2020')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Minimum year must be no greater than maximum year.')
    expect(screen.queryByText('Advanced filters applied')).not.toBeInTheDocument()
  })

  it.each([
    ['Minimum runtime', 'Maximum runtime', 'Minimum runtime must be no greater than maximum runtime.'],
    ['Minimum IMDb rating', 'Maximum IMDb rating', 'Minimum IMDb rating must be no greater than maximum rating.'],
    ['Minimum Metacritic score', 'Maximum Metacritic score', 'Minimum Metacritic score must be no greater than maximum score.'],
  ])('rejects inverted %s and %s filters', async (minimumLabel, maximumLabel, message) => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('button', { name: 'The Quiet Between' })
    await user.click(screen.getByRole('button', { name: 'Advanced search' }))
    await user.type(screen.getByLabelText(minimumLabel), '10')
    await user.type(screen.getByLabelText(maximumLabel), '1')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('Advanced filters applied')).not.toBeInTheDocument()
  })

  it('requests the next page and displays its results', async () => {
    const secondPage = {
      ...movieResponse,
      data: [{ ...movieResponse.data[0], _id: 'movie-456', title: 'The Next Page' }],
      pagination: { page: 2, limit: 30, total: 31, pages: 2, hasNextPage: false, hasPrevPage: true },
    }
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const body = url.pathname.endsWith('/genres')
        ? genresResponse
        : url.searchParams.get('page') === '2' ? secondPage : {
          ...movieResponse,
          pagination: { page: 1, limit: 30, total: 31, pages: 2, hasNextPage: true, hasPrevPage: false },
        }
      return { ok: true, json: async () => body }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByRole('button', { name: 'The Next Page' })).toBeVisible()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/[?&]page=2/),
      expect.objectContaining({}),
    )

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('button', { name: 'The Next Page' })).toBeVisible()
    await user.type(screen.getByRole('searchbox', { name: 'Search movies' }), 'Quiet')
    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('shows a backend error instead of falling back to preview movies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API unavailable')))
    render(<App />)

    expect(await screen.findByText('Could not load films')).toBeInTheDocument()
    expect(screen.getByText('API unavailable')).toBeInTheDocument()
    expect(screen.queryByText('The Quiet Between')).not.toBeInTheDocument()
  })

  it('uses a fallback message for non-Error movie load failures and retries', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/genres')) return { ok: true, json: async () => genresResponse }
      if (url.pathname === '/api/movies') throw 'unexpected failure'
      return { ok: true, json: async () => movieResponse.data[0] }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    expect(await screen.findByText('Could not load films')).toBeInTheDocument()
    expect(screen.getByText('Could not load films.')).toBeInTheDocument()

    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      return {
        ok: true,
        json: async () => url.pathname.endsWith('/genres') ? genresResponse : movieResponse,
      }
    })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
  })

  it('adds a movie to the watchlist and displays it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Add The Quiet Between to watchlist' }))

    expect(await screen.findByRole('button', { name: 'Remove The Quiet Between from watchlist' }))
      .toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Remove The Quiet Between from watchlist' }))
    expect(await screen.findByRole('button', { name: 'Add The Quiet Between to watchlist' }))
      .toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Add The Quiet Between to watchlist' }))

    await user.click(screen.getByRole('button', { name: /Watchlist/ }))

    expect(screen.getByRole('heading', { name: 'Your watchlist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'The Quiet Between' })).toBeVisible()
  })

  it('opens the featured film from its spotlight action', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Explore film' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeVisible()
    expect(within(dialog).getByRole('heading', { name: 'The Quiet Between' })).toBeVisible()
  })

  it('shows the empty watchlist state and toggles sidebar genres', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /Watchlist/ }))
    expect(screen.getByText('Your watchlist is empty')).toBeVisible()
    expect(screen.getByText('Try changing or clearing your filters.')).toBeVisible()

    const genreNavigation = screen.getByRole('navigation', { name: 'Browse by genre' })
    const drama = within(genreNavigation).getByRole('button', { name: 'Drama' })
    await user.click(drama)
    expect(drama).toHaveAttribute('aria-pressed', 'true')
    await user.click(drama)
    expect(drama).toHaveAttribute('aria-pressed', 'false')
    await user.type(screen.getByRole('searchbox', { name: 'Search genres' }), 'no such genre')
    expect(screen.getByText('No matching genres')).toBeVisible()
  })

  it('paginates the watchlist after loading saved movies for filtering and sorting', async () => {
    const savedMovieIds = Array.from({ length: 31 }, (_, index) => `watchlist-${index}`)
    window.localStorage.setItem('mosaic.watchlist.v1', JSON.stringify(savedMovieIds))
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const movieId = url.pathname.split('/').pop()
      const body = url.pathname.endsWith('/genres')
        ? genresResponse
        : url.pathname === '/api/movies' ? movieResponse : { ...movieResponse.data[0], _id: movieId, title: `Film ${movieId}` }
      return { ok: true, json: async () => body }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<App />)
    await user.click(screen.getByRole('button', { name: /Watchlist/ }))

    expect(await screen.findByRole('button', { name: 'Film watchlist-0' })).toBeVisible()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Film watchlist-30' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/movies\/watchlist-30$/),
      expect.objectContaining({}),
    )

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByRole('button', { name: 'Film watchlist-30' })).toBeVisible()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('keeps watchlist mode active and applies genre, search, and advanced filters to saved movies', async () => {
    const savedMovies = [
      { ...movieResponse.data[0], _id: 'quiet', title: 'The Quiet Between', year: 2025, genres: ['Drama'], imdb: { rating: 7.2 }, metacritic: 70 },
      { ...movieResponse.data[0], _id: 'distant', title: 'A Distant Voice', year: 2000, genres: ['Drama', 'Documentary'], imdb: { rating: 8.8 }, metacritic: 90, runtime: 120, plot: 'A story from the backend.', fullplot: 'A story from the backend.', directors: ['Mara Ellison'], cast: ['Nina Park'], rated: 'PG-13', type: 'movie' },
    ]
    window.localStorage.setItem('mosaic.watchlist.v1', JSON.stringify(['quiet', 'distant']))
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const movieId = url.pathname.split('/').pop()
      return {
        ok: true,
        json: async () => url.pathname.endsWith('/genres') ? genresResponse
          : url.pathname === '/api/movies' ? movieResponse
            : savedMovies.find((movie) => movie._id === movieId),
      }
    }))
    const user = userEvent.setup()

    render(<App />)
    await user.click(screen.getByRole('button', { name: /Watchlist/ }))
    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'A Distant Voice' })).toBeVisible()

    await user.click(screen.getAllByRole('button', { name: 'Documentary' })[0])
    expect(await screen.findByRole('button', { name: 'A Distant Voice' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'The Quiet Between' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your watchlist' })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'All films' })[0])
    await user.type(screen.getByRole('searchbox', { name: 'Search movies' }), 'Nina Park')
    expect(await screen.findByText('No watchlist films match')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'A Distant Voice' })).not.toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search movies' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search movies' }), 'Quiet')
    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'A Distant Voice' })).not.toBeInTheDocument())

    await user.clear(screen.getByRole('searchbox', { name: 'Search movies' }))
    await user.click(screen.getByRole('button', { name: 'Advanced search' }))
    await user.type(screen.getByLabelText('Title'), 'Distant')
    await user.type(screen.getByLabelText('Plot'), 'story from the backend')
    await user.type(screen.getByLabelText('Director'), 'Mara Ellison')
    await user.type(screen.getByLabelText('Cast member'), 'Nina Park')
    await user.type(screen.getByLabelText('Content rating'), 'PG-13')
    await user.type(screen.getByLabelText('Movie type'), 'movie')
    await user.type(screen.getByLabelText('Release year from'), '1990')
    await user.type(screen.getByLabelText('Minimum runtime'), '100')
    await user.type(screen.getByLabelText('Minimum IMDb rating'), '8')
    await user.type(screen.getByLabelText('Minimum Metacritic score'), '80')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(await screen.findByRole('button', { name: 'A Distant Voice' })).toBeVisible()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'The Quiet Between' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Your watchlist' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort films' }), 'imdbRating')
    await waitFor(() => {
      expect(Array.from(document.querySelectorAll('.movie-title')).map((element) => element.textContent))
        .toEqual(['A Distant Voice', 'The Quiet Between'])
    })
  })

  it('filters watchlist movies by non-matching advanced text and range criteria', { timeout: 30000 }, async () => {
    const savedMovies = [
      {
        ...movieResponse.data[0],
        _id: 'quiet',
        title: 'The Quiet Between',
        year: 2025,
        genres: ['Drama'],
        imdb: { rating: 7.2 },
        metacritic: 70,
        runtime: 100,
        plot: 'A story.',
        fullplot: 'A story.',
        directors: ['Mara Ellison'],
        cast: ['Nina Park'],
        rated: 'PG-13',
        type: 'movie',
        released: '2025-01-01',
      },
    ]
    window.localStorage.setItem('mosaic.watchlist.v1', JSON.stringify(['quiet']))
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const id = url.pathname.split('/').pop()
      return {
        ok: true,
        json: async () => url.pathname.endsWith('/genres') ? genresResponse
          : url.pathname === '/api/movies' ? movieResponse
            : savedMovies.find((movie) => movie._id === id),
      }
    }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Watchlist/ }))
    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Advanced search' }))

    const mismatchingFilters: Array<[string, string]> = [
      ['Title', 'Missing title'],
      ['Plot', 'Missing plot'],
      ['Director', 'Missing director'],
      ['Cast member', 'Missing cast'],
      ['Content rating', 'R'],
      ['Movie type', 'series'],
      ['Release year from', '2026'],
      ['Release year to', '2024'],
      ['Minimum runtime', '101'],
      ['Maximum runtime', '99'],
      ['Minimum IMDb rating', '7.3'],
      ['Maximum IMDb rating', '7.1'],
      ['Minimum Metacritic score', '71'],
      ['Maximum Metacritic score', '69'],
    ]
    for (const [label, value] of mismatchingFilters) {
      const field = screen.getByLabelText(label)
      await user.clear(field)
      await user.type(field, value)
      await user.click(screen.getByRole('button', { name: 'Apply filters' }))
      expect(await screen.findByText('No watchlist films match')).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Clear filters' }))
      expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    }


  })

  it('sorts watchlist films using every available sort field and direction', async () => {
    const savedMovies = [
      {
        ...movieResponse.data[0],
        _id: 'first',
        title: 'Zulu',
        year: 2020,
        runtime: 90,
        imdb: { rating: 7 },
        metacritic: 80,
        released: '2020-01-01',
      },
      {
        ...movieResponse.data[0],
        _id: 'second',
        title: 'Alpha',
        year: 2025,
        runtime: 120,
        imdb: { rating: 9 },
        metacritic: null,
        released: '',
      },
    ]
    window.localStorage.setItem('mosaic.watchlist.v1', JSON.stringify(['first', 'second']))
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const id = url.pathname.split('/').pop()
      return {
        ok: true,
        json: async () => url.pathname.endsWith('/genres') ? genresResponse
          : url.pathname === '/api/movies' ? movieResponse
            : savedMovies.find((movie) => movie._id === id),
      }
    }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Watchlist/ }))
    await screen.findByRole('button', { name: 'Zulu' })

    const sortCases: Array<[string, string]> = [
      ['title', 'asc'],
      ['year', 'desc'],
      ['runtime', 'asc'],
      ['imdbRating', 'desc'],
      ['metacritic', 'asc'],
      ['released', 'asc'],
    ]
    for (const [sort, order] of sortCases) {
      await user.selectOptions(screen.getByRole('combobox', { name: 'Sort films' }), sort)
      await user.selectOptions(screen.getByRole('combobox', { name: 'Sort direction' }), order)
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Sort films' })).toHaveValue(sort)
        expect(screen.getByRole('combobox', { name: 'Sort direction' })).toHaveValue(order)
      })
    }
    expect(document.querySelector('.movie-title')?.textContent).toBe('Alpha')

    const sortSelect = screen.getByRole('combobox', { name: 'Sort films' })
    const sortOrderSelect = screen.getByRole('combobox', { name: 'Sort direction' })
    const requestCount = vi.mocked(fetch).mock.calls.length
    fireEvent.change(sortSelect, { target: { value: 'unsupported' } })
    fireEvent.change(sortOrderSelect, { target: { value: 'sideways' } })
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(requestCount)
  })

  it('opens film details, loads comments, posts a comment, and closes from the backdrop', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/genres')) return { ok: true, json: async () => genresResponse }
      if (url.pathname === '/api/movies') return { ok: true, json: async () => movieResponse }
      if (url.pathname === '/api/comments' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ comment: { _id: 'comment-new', name: 'A Fan', text: 'Loved it.' } }),
        }
      }
      if (url.pathname === '/api/comments') {
        return { ok: true, json: async () => ({ comments: [{ _id: 'comment-old', name: 'Lee', text: 'Great!', date: '2025-01-01' }] }) }
      }
      return { ok: true, json: async () => movieResponse.data[0] }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'View The Quiet Between' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('A story from the backend.')).toBeVisible()
    expect(within(dialog).getByText('Mara Ellison')).toBeVisible()
    expect(await within(dialog).findByText('Great!')).toBeVisible()
    await user.type(within(dialog).getByLabelText('Your name'), 'A Fan')
    await user.type(within(dialog).getByLabelText('Your comment'), 'Loved it.')
    await user.click(within(dialog).getByRole('button', { name: 'Post comment' }))

    expect(await within(dialog).findByText('Loved it.')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/comments'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ movie_id: 'movie-123', name: 'A Fan', text: 'Loved it.' }),
      }),
    )
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the comment loading state while the post request is pending', async () => {
    let resolveComment!: (response: { ok: boolean; json: () => Promise<unknown> }) => void
    const pendingComment = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolveComment = resolve
    })
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/genres')) return { ok: true, json: async () => genresResponse }
      if (url.pathname === '/api/movies') return { ok: true, json: async () => movieResponse }
      if (url.pathname === '/api/comments' && init?.method === 'POST') return pendingComment
      if (url.pathname === '/api/comments') return { ok: true, json: async () => [] }
      return { ok: true, json: async () => movieResponse.data[0] }
    }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'The Quiet Between' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Your name'), 'Fan')
    await user.type(within(dialog).getByLabelText('Your comment'), 'A thought')
    await user.click(within(dialog).getByRole('button', { name: 'Post comment' }))

    expect(within(dialog).getByRole('button', { name: 'Posting...' })).toBeDisabled()
    resolveComment({ ok: true, json: async () => ({ id: 'comment-pending', name: 'Fan', text: 'A thought' }) })
    expect(await within(dialog).findByText('A thought')).toBeVisible()
  })

  it('ignores a pending comments response after film details close', async () => {
    let rejectComments!: (reason: unknown) => void
    const pendingComments = new Promise((_, reject) => { rejectComments = reject })
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/genres')) return Promise.resolve({ ok: true, json: async () => genresResponse })
      if (url.pathname === '/api/movies') return Promise.resolve({ ok: true, json: async () => movieResponse })
      if (url.pathname === '/api/comments') return pendingComments
      return Promise.resolve({ ok: true, json: async () => movieResponse.data[0] })
    }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'View The Quiet Between' }))
    await screen.findByRole('dialog')
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/comments?movieId=movie-123'),
      expect.objectContaining({}),
    ))
    await user.click(screen.getByRole('button', { name: 'Close film details' }))
    rejectComments('comments request cancelled')
    await Promise.resolve()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders poster images in cards and film details', async () => {
    const movieWithPoster = { ...movieResponse.data[0], poster: 'https://example.test/poster.png' }
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      return {
        ok: true,
        json: async () => url.pathname.endsWith('/genres') ? genresResponse
          : url.pathname === '/api/movies'
            ? { ...movieResponse, data: [movieWithPoster] }
            : movieWithPoster,
      }
    }))
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('img', { name: 'The Quiet Between film still' })).toHaveAttribute(
      'src',
      'https://example.test/poster.png',
    )
    await user.click(screen.getByRole('button', { name: 'View The Quiet Between' }))
    expect((await screen.findByRole('dialog')).querySelector('.detail-hero')).toHaveStyle({
      backgroundImage: expect.stringContaining('poster.png'),
    }    )
  })

  it('shows the neutral poster placeholder when an image fails to load', async () => {
    const movieWithPoster = { ...movieResponse.data[0], poster: 'https://example.test/missing-poster.png' }
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      return {
        ok: true,
        json: async () => url.pathname.endsWith('/genres') ? genresResponse
          : url.pathname === '/api/movies'
            ? { ...movieResponse, data: [movieWithPoster] }
            : movieWithPoster,
      }
    }))
    render(<App />)

    const poster = await screen.findByRole('img', { name: 'The Quiet Between film still' })
    fireEvent.error(poster)

    expect(screen.queryByRole('img', { name: 'The Quiet Between film still' })).not.toBeInTheDocument()
    const placeholder = screen.getByRole('img', { name: 'The Quiet Between poster unavailable' })
    expect(placeholder).toBeVisible()
    expect(within(placeholder).getByText('The Quiet Between')).toBeVisible()
  })

  it('shows a comment posting error and handles missing detail fields', async () => {
    const minimalMovie = {
      _id: 'minimal-movie',
      title: 'Untitled Test',
      year: 0,
      genres: [],
      imdb: { rating: 0 },
      runtime: 0,
      directors: [],
      cast: [],
      poster: '',
    }
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/genres')) return { ok: true, json: async () => genresResponse }
      if (url.pathname === '/api/movies') {
        return {
          ok: true,
          json: async () => ({ ...movieResponse, data: [minimalMovie] }),
        }
      }
      if (url.pathname === '/api/comments' && init?.method === 'POST') {
        return Promise.reject('Unexpected comment failure')
      }
      if (url.pathname === '/api/comments') return { ok: true, json: async () => ({}) }
      return { ok: true, json: async () => minimalMovie }
    }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'View Untitled Test' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('No synopsis is available for this film yet.')).toBeVisible()
    expect(within(dialog).getAllByText('Not listed')).toHaveLength(3)
    expect(within(dialog).getByText('Feature film')).toBeVisible()
    await user.type(within(dialog).getByLabelText('Your name'), 'Fan')
    await user.type(within(dialog).getByLabelText('Your comment'), 'A thought')
    await user.click(within(dialog).getByRole('button', { name: 'Post comment' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not post your comment.')
  })

  it('displays comment API errors while details remain open', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/genres')) return { ok: true, json: async () => genresResponse }
      if (url.pathname === '/api/movies') return { ok: true, json: async () => movieResponse }
      if (url.pathname === '/api/comments' && init?.method === 'POST') {
        return { ok: false, status: 500, json: async () => ({ error: 'Comment unavailable' }) }
      }
      if (url.pathname === '/api/comments') return { ok: true, json: async () => [] }
      return { ok: true, json: async () => movieResponse.data[0] }
    }))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'View The Quiet Between' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.submit(dialog.querySelector('form')!)
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Your name'), 'Fan')
    await user.type(within(dialog).getByLabelText('Your comment'), 'A thought')
    await user.click(within(dialog).getByRole('button', { name: 'Post comment' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Request failed (500).')
  })

  it('displays a comments loading failure while the detail dialog is open', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/genres')) return { ok: true, json: async () => genresResponse }
      if (url.pathname === '/api/movies') return { ok: true, json: async () => movieResponse }
      if (url.pathname === '/api/comments') return { ok: false, status: 503, json: async () => ({}) }
      return { ok: true, json: async () => movieResponse.data[0] }
    }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'View The Quiet Between' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Be the first to leave a thought.')).toBeVisible()
  })

  it('does not update movie state after a pending catalog request is cancelled', async () => {
    let rejectMovies!: (reason: unknown) => void
    const movieRequest = new Promise((_, reject) => { rejectMovies = reject })
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname === '/api/movies') return movieRequest
      return Promise.resolve({
        ok: true,
        json: async () => url.pathname.endsWith('/genres') ? genresResponse : movieResponse.data[0],
      })
    }))
    const { unmount } = render(<App />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/movies?'),
      expect.objectContaining({}),
    ))

    unmount()
    rejectMovies('request cancelled')
    await Promise.resolve()
  })

  it('ignores a successful catalog response after the page unmounts', async () => {
    let resolveMovies!: (response: { ok: boolean; json: () => Promise<unknown> }) => void
    const pendingMovies = new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
      resolveMovies = resolve
    })
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname === '/api/movies') return pendingMovies
      return Promise.resolve({
        ok: true,
        json: async () => url.pathname.endsWith('/genres') ? genresResponse : movieResponse.data[0],
      })
    }))
    const { unmount } = render(<App />)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/movies?'),
      expect.objectContaining({}),
    ))

    unmount()
    resolveMovies({
      ok: true,
      json: async () => movieResponse,
    })
    await Promise.resolve()
  })

  it('returns to discover when its sidebar link is clicked from the watchlist', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Add The Quiet Between to watchlist' }))
    await user.click(screen.getByRole('button', { name: /Watchlist/ }))
    expect(screen.getByRole('heading', { name: 'Your watchlist' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Discover' }))

    expect(screen.getByRole('heading', { name: 'A little of everything' })).toBeInTheDocument()
  })

  it('restores saved movies after the app is reopened', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Add The Quiet Between to watchlist' }))
    unmount()
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Remove The Quiet Between from watchlist' }))
      .toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /Watchlist/ }))
    expect(screen.getByRole('button', { name: 'The Quiet Between' })).toBeVisible()
  })
})
