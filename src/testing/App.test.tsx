import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
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
  })

  it('selects the active sort order and requests the matching movie sort', async () => {
    const user = userEvent.setup()
    render(<App />)

    const sortSelect = await screen.findByRole('combobox', { name: 'Sort films' })
    expect(sortSelect).toHaveValue('recent')

    await user.selectOptions(sortSelect, 'rating')

    expect(sortSelect).toHaveValue('rating')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/[?&]sort=imdbRating/),
      expect.objectContaining({}),
    )

    await user.selectOptions(sortSelect, 'recent')

    expect(sortSelect).toHaveValue('recent')
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
    await user.click(screen.getByRole('button', { name: 'Advanced search' }))
    await user.type(screen.getByLabelText('Title'), 'Quiet')
    await user.type(screen.getByLabelText('Release year from'), '2020')
    await user.type(screen.getByLabelText('Minimum IMDb rating'), '8')
    await user.selectOptions(screen.getByLabelText('Sort results by'), 'imdbRating')
    await user.selectOptions(screen.getByLabelText('Sort direction'), 'asc')
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
  })

  it('shows a backend error instead of falling back to preview movies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API unavailable')))
    render(<App />)

    expect(await screen.findByText('Could not load films')).toBeInTheDocument()
    expect(screen.getByText('API unavailable')).toBeInTheDocument()
    expect(screen.queryByText('The Quiet Between')).not.toBeInTheDocument()
  })

  it('adds a movie to the watchlist and displays it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Add The Quiet Between to watchlist' }))

    expect(await screen.findByRole('button', { name: 'Remove The Quiet Between from watchlist' }))
      .toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /Watchlist/ }))

    expect(screen.getByRole('heading', { name: 'Your watchlist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'The Quiet Between' })).toBeVisible()
  })

  it('paginates the watchlist and fetches only the saved movies on the current page', async () => {
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
    expect(fetchMock.mock.calls.some(([input]) => new URL(String(input)).pathname.endsWith('/watchlist-30'))).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByRole('button', { name: 'Film watchlist-30' })).toBeVisible()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/movies\/watchlist-30$/),
      expect.objectContaining({}),
    )
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
