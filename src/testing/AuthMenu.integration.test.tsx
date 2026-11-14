import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

const authStorageKey = 'mosaic.auth.v1'
const session = {
  token: 'test-jwt',
  user: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
}

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
}

type AuthRoute = 'register' | 'login' | 'logout'
type AuthResponses = Partial<Record<AuthRoute, () => Response | Promise<Response>>>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubBackend(authResponses: AuthResponses = {}) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/api/movies/genres')) return jsonResponse({ genres: ['Drama', 'Mystery'] })
    if (new URL(url).pathname === '/api/movies') return jsonResponse({
      ...movieResponse,
      pagination: { page: 1, limit: 30, total: 1, pages: 1, hasNextPage: false, hasPrevPage: false },
    })

    const route: AuthRoute | undefined = url.endsWith('/api/users') && init?.method === 'POST'
      ? 'register'
      : url.endsWith('/api/users/login')
        ? 'login'
        : url.endsWith('/api/users/logout')
          ? 'logout'
          : undefined
    const responseFactory = route ? authResponses[route] : undefined
    return responseFactory ? responseFactory() : jsonResponse({ error: 'Unexpected API request' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('account menu integration', () => {
  beforeEach(() => {
    window.localStorage.clear()
    stubBackend()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('opens and closes the login menu with Escape or an outside click', async () => {
    const user = userEvent.setup()
    render(<App />)
    const menuButton = screen.getByRole('button', { name: 'Open login menu' })

    await user.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Welcome back')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(menuButton)
    await user.click(screen.getByRole('searchbox', { name: 'Search movies' }))
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('registers, returns to login, then logs in and persists the session', async () => {
    const fetchMock = stubBackend({
      register: () => jsonResponse({ message: 'User created successfully' }, 201),
      login: () => jsonResponse(session),
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.click(screen.getByRole('button', { name: /Create one/ }))
    await user.type(screen.getByLabelText('Username'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.type(screen.getByLabelText('Confirm password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Account created successfully. Please log in.')
    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/users$/), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com', password: 'correct-password' }),
    }))

    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('button', { name: 'Account menu for Jane Doe' })).toBeInTheDocument()
    expect(window.localStorage.getItem(authStorageKey)).toBe(JSON.stringify(session))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/users/login'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'jane@example.com', password: 'correct-password' }),
    }))
  })

  it('keeps guest and signed-in watchlists separate when the account changes', async () => {
    window.localStorage.setItem('mosaic.watchlist.v1', JSON.stringify(['guest-movie']))
    window.localStorage.setItem('mosaic.watchlist.v1.user.user-1', JSON.stringify(['account-movie-1', 'account-movie-2']))
    stubBackend({ login: () => jsonResponse(session) })
    const user = userEvent.setup()
    render(<App />)
    const watchlistButton = screen.getByRole('button', { name: /Watchlist/ })

    expect(watchlistButton).toHaveTextContent('1')
    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('button', { name: 'Account menu for Jane Doe' })).toBeVisible()
    expect(watchlistButton).toHaveTextContent('2')
    expect(window.localStorage.getItem('mosaic.watchlist.v1.user.user-1'))
      .toBe(JSON.stringify(['account-movie-1', 'account-movie-2']))

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('button', { name: 'Open login menu' })).toBeVisible()
    expect(watchlistButton).toHaveTextContent('1')
    expect(window.localStorage.getItem('mosaic.watchlist.v1.guest')).toBe(JSON.stringify(['guest-movie']))
  })

  it('does not send registration when the passwords differ', async () => {
    const fetchMock = stubBackend()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.click(screen.getByRole('button', { name: /Create one/ }))
    await user.type(screen.getByLabelText('Username'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.type(screen.getByLabelText('Confirm password'), 'different-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringMatching(/\/api\/users$/), expect.objectContaining({ method: 'POST' }))
  })

  it('rejects a whitespace-padded username outside backend length limits', async () => {
    const fetchMock = stubBackend()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.click(screen.getByRole('button', { name: /Create one/ }))
    await user.type(screen.getByLabelText('Username'), ' ab ')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.type(screen.getByLabelText('Confirm password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Username must be between 4 and 25 characters.')
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringMatching(/\/api\/users$/), expect.objectContaining({ method: 'POST' }))
  })

  it('shows a registration error and stays on the registration form', async () => {
    stubBackend({
      register: () => jsonResponse({ error: 'Email already in use' }, 409),
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.click(screen.getByRole('button', { name: /Create one/ }))
    await user.type(screen.getByLabelText('Username'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.type(screen.getByLabelText('Confirm password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already in use')
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
  })

  it('shows a fallback error when registration rejects with a non-Error value', async () => {
    stubBackend({ register: () => Promise.reject('Unexpected registration failure') })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.click(screen.getByRole('button', { name: /Create one/ }))
    await user.type(screen.getByLabelText('Username'), 'Jane Doe')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.type(screen.getByLabelText('Confirm password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create your account.')
  })

  it('shows credential errors above the email field after a rejected login', async () => {
    stubBackend({ login: () => jsonResponse({ error: 'Invalid credentials' }, 401) })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const alert = await screen.findByRole('alert')
    const emailInput = screen.getByLabelText('Email')
    expect(alert).toHaveTextContent('Invalid username or password.')
    expect(Boolean(alert.compareDocumentPosition(emailInput) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(window.localStorage.getItem(authStorageKey)).toBeNull()
  })

  it('shows a loading state while the login request is pending', async () => {
    let resolveLogin!: (response: Response) => void
    const pendingLogin = new Promise<Response>((resolve) => { resolveLogin = resolve })
    stubBackend({ login: () => pendingLogin })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const submitButton = screen.getByRole('button', { name: 'Signing in…' })
    expect(submitButton).toBeDisabled()
    resolveLogin(jsonResponse(session))

    expect(await screen.findByRole('button', { name: 'Account menu for Jane Doe' })).toBeInTheDocument()
  })

  it('logs out and clears the saved session even if the server rejects logout', async () => {
    window.localStorage.setItem(authStorageKey, JSON.stringify(session))
    const fetchMock = stubBackend({
      logout: () => jsonResponse({ error: 'Session expired' }, 401),
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Account menu for Jane Doe' }))
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('button', { name: 'Open login menu' })).toBeVisible()
    expect(window.localStorage.getItem(authStorageKey)).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/users/logout'), expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer test-jwt' },
    }))
  })

  it('restores a previously saved login session', async () => {
    window.localStorage.setItem(authStorageKey, JSON.stringify(session))
    render(<App />)

    expect(screen.getByRole('button', { name: 'Account menu for Jane Doe' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Account menu for Jane Doe' }))
    expect(within(screen.getByRole('region', { name: 'Account menu' })).getByText('jane@example.com')).toBeInTheDocument()
  })

  it('ignores malformed saved auth and watchlist data', async () => {
    window.localStorage.setItem(authStorageKey, '{invalid')
    window.localStorage.setItem('mosaic.watchlist.v1.guest', '{"not":"an array"}')
    render(<App />)

    expect(screen.getByRole('button', { name: 'Open login menu' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Watchlist/ })).toHaveTextContent('0')
  })

  it.each([null, {}, { user: null }])('ignores structurally invalid saved auth data: %j', (savedSession) => {
    window.localStorage.setItem(authStorageKey, JSON.stringify(savedSession))
    render(<App />)

    expect(screen.getByRole('button', { name: 'Open login menu' })).toBeVisible()
  })

  it('filters non-string watchlist IDs from saved storage', () => {
    window.localStorage.setItem('mosaic.watchlist.v1.guest', JSON.stringify(['movie-1', 42, null, 'movie-2']))
    render(<App />)

    expect(screen.getByRole('button', { name: /Watchlist/ })).toHaveTextContent('2')
  })

  it('continues with an empty watchlist when browser storage cannot be read', () => {
    const originalGetItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key.startsWith('mosaic.watchlist.')) throw new Error('Storage unavailable')
      return originalGetItem.call(this, key)
    })
    render(<App />)

    expect(screen.getByRole('button', { name: /Watchlist/ })).toHaveTextContent('0')
  })

  it('keeps the watchlist usable when browser storage cannot save it', async () => {
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith('mosaic.watchlist.')) throw new Error('Storage unavailable')
      originalSetItem.call(this, key, value)
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Add The Quiet Between to watchlist' }))

    expect(screen.getByRole('button', { name: 'Remove The Quiet Between from watchlist' }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('reports a browser storage failure after a successful login', async () => {
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === authStorageKey) throw new Error('Storage unavailable')
      originalSetItem.call(this, key, value)
    })
    stubBackend({ login: () => jsonResponse(session) })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You are signed in, but this browser could not save your session.',
    )
    expect(screen.getByRole('button', { name: 'Account menu for Jane Doe' })).toBeVisible()
  })

  it('finishes sign-out and reports when browser storage cannot clear the session', async () => {
    window.localStorage.setItem(authStorageKey, JSON.stringify(session))
    const originalRemoveItem = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      if (key === authStorageKey) throw new Error('Storage unavailable')
      originalRemoveItem.call(this, key)
    })
    stubBackend({ logout: () => jsonResponse({ message: 'Logged out successfully' }) })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Account menu for Jane Doe' }))
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Signed out, but this browser could not clear the saved session.',
    )
    expect(screen.getByRole('button', { name: 'Open login menu' })).toBeVisible()
  })

  it('uses the fallback logout error for a non-Error server failure', async () => {
    window.localStorage.setItem(authStorageKey, JSON.stringify(session))
    stubBackend({ logout: () => Promise.reject('Unexpected logout failure') })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Account menu for Jane Doe' }))
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Signed out here, but the server could not end the session: Request failed.',
    )
  })

  it('shows a fallback error when login rejects with a non-Error value', async () => {
    stubBackend({ login: () => Promise.reject('Unexpected login failure') })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign in.')
  })

  it('clears registration fields when switching back to login', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Open login menu' }))
    await user.click(screen.getByRole('button', { name: /Create one/ }))
    await user.type(screen.getByLabelText('Username'), 'Jane Doe')
    await user.type(screen.getByLabelText('Confirm password'), 'temporary-password')
    await user.click(screen.getByRole('button', { name: 'Already have an account? Log in' }))

    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('')
  })

  it('shows genre loading errors in the sidebar and catalog', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/genres')) {
        return { ok: false, status: 503, json: async () => ({}) }
      }
      if (url.pathname === '/api/movies') {
        return jsonResponse({
          ...movieResponse,
          pagination: { page: 1, limit: 30, total: 1, pages: 1, hasNextPage: false, hasPrevPage: false },
        })
      }
      return jsonResponse(movieResponse.data[0])
    }))
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load genres: Request failed (503).')
    expect(screen.getByRole('button', { name: 'The Quiet Between' })).toBeVisible()
  })

  it('uses a fallback genre error when loading rejects with a non-Error value', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/genres')) return Promise.reject('Unexpected genre failure')
      return Promise.resolve(jsonResponse({
        ...movieResponse,
        pagination: { page: 1, limit: 30, total: 1, pages: 1, hasNextPage: false, hasPrevPage: false },
      }))
    }))
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load genres.')
  })
})
