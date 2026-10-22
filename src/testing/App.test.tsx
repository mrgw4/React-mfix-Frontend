import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
