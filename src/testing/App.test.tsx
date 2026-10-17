import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

describe('movie watchlist', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
      }),
    }))
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.unstubAllGlobals()
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

  it('loads movies from the backend response', async () => {
    render(<App />)

    expect(await screen.findByRole('button', { name: 'The Quiet Between' })).toBeVisible()
    expect(screen.getByText('Connected to your collection')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/movies?limit=30'), expect.objectContaining({}))
  })

  it('shows a backend error instead of falling back to preview movies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API unavailable')))
    render(<App />)

    expect(await screen.findByText('Could not load films')).toBeInTheDocument()
    expect(screen.getByText('API unavailable')).toBeInTheDocument()
    expect(screen.queryByText('The Quiet Between')).not.toBeInTheDocument()
  })

  it('logs in through the account menu and saves the returned session', async () => {
    const session = {
      token: 'test-jwt',
      user: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
    }
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/users/login')) {
        expect(init?.method).toBe('POST')
        expect(init?.body).toBe(JSON.stringify({ email: 'jane@example.com', password: 'correct-password' }))
        return { ok: true, json: async () => session }
      }
      return {
        ok: true,
        json: async () => ({ data: [{ _id: 'movie-123', title: 'The Quiet Between' }] }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Guest profile' }))
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findAllByText('jane@example.com')).toHaveLength(2)
    expect(window.localStorage.getItem('mosaic.auth.v1')).toBe(JSON.stringify(session))
    expect(screen.getAllByText('Jane Doe')).toHaveLength(2)
  })

  it('logs out through the account menu and clears the saved session', async () => {
    const session = {
      token: 'test-jwt',
      user: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
    }
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/api/users/login')) {
        return { ok: true, json: async () => session }
      }
      if (String(input).endsWith('/api/users/logout')) {
        return { ok: true, json: async () => ({ message: 'Logged out successfully' }) }
      }
      return {
        ok: true,
        json: async () => ({ data: [{ _id: 'movie-123', title: 'The Quiet Between' }] }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Guest profile' }))
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    await user.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/users/logout'), expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer test-jwt' },
    }))
    expect(window.localStorage.getItem('mosaic.auth.v1')).toBeNull()
    expect(await screen.findByRole('button', { name: 'Guest profile' })).toBeVisible()
  })

  it('shows login errors returned by the backend', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/api/users/login')) {
        return { ok: false, json: async () => ({ error: 'Invalid credentials' }) }
      }
      return {
        ok: true,
        json: async () => ({ data: [{ _id: 'movie-123', title: 'The Quiet Between' }] }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Guest profile' }))
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials')
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