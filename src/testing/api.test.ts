import { afterEach, describe, expect, it, vi } from 'vitest'
import { getGenres, getMovies, login, logout, register, type AuthSession } from '../api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('auth API unit tests', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('movie API unit tests', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('maps movies from the paginated backend response', async () => {
      const fetchMock = stubFetch(jsonResponse({
        data: [{
          _id: 'movie-1',
          title: 'A Movie',
          year: 2000,
          genres: ['Drama'],
          imdb: { rating: 7.5 },
          runtime: 90,
          plot: 'A story.',
          directors: ['A Director'],
          cast: ['An Actor'],
          poster: 'poster.jpg',
        }],
        pagination: { page: 1, limit: 30, total: 1, pages: 1, hasNextPage: false, hasPrevPage: false },
      }))

      await expect(getMovies({
        page: 3,
        genres: ['Documentary', 'Drama'],
        search: 'Mara',
        sortByRating: true,
      })).resolves.toEqual({
        movies: [{
          id: 'movie-1',
          title: 'A Movie',
          year: 2000,
          genres: ['Drama'],
          rating: 7.5,
          runtime: 90,
          plot: 'A story.',
          director: 'A Director',
          cast: ['An Actor'],
          rated: '',
          type: '',
          metacritic: null,
          released: '',
          posterUrl: 'poster.jpg',
        }],
        pagination: {
          page: 1,
          limit: 30,
          total: 1,
          pages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      })
      const requestUrl = new URL(String(fetchMock.mock.calls[0][0]))
      expect(requestUrl.pathname).toBe('/api/movies')
      expect(requestUrl.searchParams.get('page')).toBe('3')
      expect(requestUrl.searchParams.get('limit')).toBe('30')
      expect(requestUrl.searchParams.get('genres')).toBe('Documentary,Drama')
      expect(requestUrl.searchParams.get('search')).toBe('Mara')
      expect(requestUrl.searchParams.get('sort')).toBe('imdbRating')
      expect(requestUrl.searchParams.get('order')).toBe('desc')
    })

    it('loads and normalizes genres from the backend genres endpoint', async () => {
      const fetchMock = stubFetch(jsonResponse({ genres: ['Drama', 'Mystery', 'Drama', ' '] }))

      await expect(getGenres()).resolves.toEqual(['Drama', 'Mystery'])
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/movies/genres'),
        expect.objectContaining({}),
      )
    })

    it('sends advanced movie criteria and sorting to the backend', async () => {
      const fetchMock = stubFetch(jsonResponse({
        data: [],
        pagination: { page: 1, limit: 30, total: 0, pages: 0, hasNextPage: false, hasPrevPage: false },
      }))

      await getMovies({
        title: '  Arrival  ',
        directors: 'Denis Villeneuve',
        imdbRatingMin: 7.5,
        yearMax: 2016,
        sort: 'metacritic',
        order: 'asc',
      })

      const requestUrl = new URL(String(fetchMock.mock.calls[0][0]))
      expect(requestUrl.searchParams.get('title')).toBe('Arrival')
      expect(requestUrl.searchParams.get('directors')).toBe('Denis Villeneuve')
      expect(requestUrl.searchParams.get('imdbRatingMin')).toBe('7.5')
      expect(requestUrl.searchParams.get('yearMax')).toBe('2016')
      expect(requestUrl.searchParams.get('sort')).toBe('metacritic')
      expect(requestUrl.searchParams.get('order')).toBe('asc')
    })
  })

  it('posts credentials and normalizes a valid login session', async () => {
    const session: AuthSession = {
      token: 'test-token',
      user: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
    }
    const fetchMock = stubFetch(jsonResponse(session))

    await expect(login('jane@example.com', 'correct-password')).resolves.toEqual(session)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/login'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jane@example.com', password: 'correct-password' }),
      }),
    )
  })

  it('uses the generic credential message for a JSON 401 response', async () => {
    stubFetch(jsonResponse({ error: 'Invalid credentials' }, 401))

    await expect(login('jane@example.com', 'wrong-password'))
      .rejects.toThrow('Invalid username or password.')
  })

  it('uses the generic credential message for an empty 401 response', async () => {
    stubFetch(new Response(null, { status: 401 }))

    await expect(login('jane@example.com', 'wrong-password'))
      .rejects.toThrow('Invalid username or password.')
  })

  it('uses the HTTP status when another auth error has no JSON body', async () => {
    stubFetch(new Response(null, { status: 503 }))

    await expect(register('Jane Doe', 'jane@example.com', 'correct-password'))
      .rejects.toThrow('Request failed (503).')
  })

  it.each([
    ['missing token', { user: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' } }],
    ['empty token', { token: '', user: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' } }],
    ['missing id', { token: 'test-token', user: { name: 'Jane Doe', email: 'jane@example.com' } }],
    ['missing name', { token: 'test-token', user: { id: 'user-1', email: 'jane@example.com' } }],
    ['missing email', { token: 'test-token', user: { id: 'user-1', name: 'Jane Doe' } }],
  ])('rejects a successful login response with %s', async (_caseName, body) => {
    stubFetch(jsonResponse(body))

    await expect(login('jane@example.com', 'correct-password'))
      .rejects.toThrow('The server returned an invalid login response.')
  })

  it('reports a malformed JSON body on a successful auth response', async () => {
    stubFetch(new Response('{not-json', { status: 200 }))

    await expect(login('jane@example.com', 'correct-password'))
      .rejects.toThrow('The server returned an invalid response.')
  })

  it('sends registration data using the backend name field', async () => {
    const fetchMock = stubFetch(jsonResponse({ message: 'User created successfully' }, 201))

    await expect(register('Jane Doe', 'jane@example.com', 'correct-password')).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/users$/),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'correct-password',
        }),
      }),
    )
  })

  it('returns the backend validation message when registration is rejected', async () => {
    stubFetch(jsonResponse({ error: 'Email already in use' }, 409))

    await expect(register('Jane Doe', 'jane@example.com', 'correct-password'))
      .rejects.toThrow('Email already in use')
  })

  it('sends the saved token when logging out', async () => {
    const fetchMock = stubFetch(jsonResponse({ message: 'Logged out successfully' }))

    await expect(logout('test-token')).resolves.toEqual({ message: 'Logged out successfully' })

    const [, request] = fetchMock.mock.calls[0]
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/users/logout')
    expect(request?.method).toBe('POST')
    expect(request?.headers).toMatchObject({ Authorization: expect.stringContaining('test-token') })
  })

  it('propagates network failures to the caller', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Network unavailable'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(login('jane@example.com', 'correct-password'))
      .rejects.toThrow('Network unavailable')
  })
})
