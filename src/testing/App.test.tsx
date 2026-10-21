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
  pagination: { page: 1, limit: 30, total: 1, pages: 1 },
}
const genresResponse = { genres: ['Drama', 'Mystery', 'Documentary'] }

describe('movie discovery integration', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string | URL | Request) => ({
      ok: true,
      json: async () => String(input).includes('/genres') ? genresResponse : movieResponse,
    })))
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
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/movies?limit=30'), expect.objectContaining({}))
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/movies/genres'), expect.objectContaining({}))
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
