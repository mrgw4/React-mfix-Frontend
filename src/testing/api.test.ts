import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createComment,
  getComments,
  getGenres,
  getMovie,
  getMovies,
  login,
  logout,
  register,
  type AuthSession,
} from '../api'

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
          fullplot: 'The full story.',
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
          plot: 'The full story.',
          plotForFiltering: 'A story.',
          director: 'A Director',
          directors: ['A Director'],
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

    it('normalizes alternate movie field shapes and supplies safe fallbacks', async () => {
      stubFetch(jsonResponse({
        data: [
          null,
          {
            id: 'alternate-movie',
            title: 42,
            year: '0',
            genre: 'Drama, Mystery',
            rating: 6.5,
            runtime: '90',
            overview: 'An overview.',
            director: 'A Director',
            directors: ['A Director'],
            actors: ['Actor One', 2, null],
            metacritic: 75,
            poster_url: 'poster.png',
          },
          {
            _id: 'empty-movie',
            genres: [null, 7, 'Comedy'],
            imdb: null,
            vote_average: 8,
            metacritic: 'not-a-score',
            posterUrl: 'direct-poster.png',
            poster: 'fallback-poster.png',
          },
        ],
        pagination: { page: 1, limit: 30, total: 3, pages: 1, hasNextPage: false, hasPrevPage: false },
      }))

      const { movies } = await getMovies()
      expect(movies[0]).toMatchObject({
        id: 'movie-0',
        title: 'Untitled film',
        genres: [],
        directors: [],
        director: '',
        cast: [],
        plot: '',
        posterUrl: '',
        metacritic: null,
      })
      expect(movies[1]).toMatchObject({
        id: 'alternate-movie',
        title: '42',
        genres: ['Drama', 'Mystery'],
        directors: ['A Director'],
        director: 'A Director',
        cast: ['Actor One', '2'],
        rating: 6.5,
        plot: 'An overview.',
        metacritic: 75,
        posterUrl: 'poster.png',
      })
      expect(movies[2]).toMatchObject({
        plot: '',
        rating: 8,
        metacritic: null,
        posterUrl: 'direct-poster.png',
      })
    })

    it.each([
      ['data is not an array', { data: {}, pagination: { page: 1, limit: 30, total: 0, pages: 0, hasNextPage: false, hasPrevPage: false } }],
      ['page is not numeric', { data: [], pagination: { page: '1', limit: 30, total: 0, pages: 0, hasNextPage: false, hasPrevPage: false } }],
      ['limit is not numeric', { data: [], pagination: { page: 1, limit: '30', total: 0, pages: 0, hasNextPage: false, hasPrevPage: false } }],
      ['total is not numeric', { data: [], pagination: { page: 1, limit: 30, total: '0', pages: 0, hasNextPage: false, hasPrevPage: false } }],
      ['pages is not numeric', { data: [], pagination: { page: 1, limit: 30, total: 0, pages: '0', hasNextPage: false, hasPrevPage: false } }],
      ['hasNextPage is not boolean', { data: [], pagination: { page: 1, limit: 30, total: 0, pages: 0, hasNextPage: 0, hasPrevPage: false } }],
      ['hasPrevPage is not boolean', { data: [], pagination: { page: 1, limit: 30, total: 0, pages: 0, hasNextPage: false, hasPrevPage: 0 } }],
    ])('rejects invalid movie list response when %s', async (_description, body) => {
      stubFetch(jsonResponse(body))
      await expect(getMovies()).rejects.toThrow('The server returned an invalid movie list response.')
    })

    it('uses the year default when rating sorting is disabled and preserves zero range bounds', async () => {
      const fetchMock = stubFetch(jsonResponse({
        data: [],
        pagination: { page: 1, limit: 30, total: 0, pages: 0, hasNextPage: false, hasPrevPage: false },
      }))

      await getMovies({
        sortByRating: false,
        yearMin: 0,
        runtimeMax: 0,
        metacriticMin: 0,
        title: '   ',
        genres: [],
      })

      const url = new URL(String(fetchMock.mock.calls[0][0]))
      expect(url.searchParams.get('sort')).toBe('year')
      expect(url.searchParams.get('yearMin')).toBe('0')
      expect(url.searchParams.get('runtimeMax')).toBe('0')
      expect(url.searchParams.get('metacriticMin')).toBe('0')
      expect(url.searchParams.has('title')).toBe(false)
      expect(url.searchParams.has('genres')).toBe(false)
    })

    it('encodes movie IDs and normalizes a movie fetched by ID', async () => {
      const fetchMock = stubFetch(jsonResponse({ _id: 'movie/one', director: 'Solo Director', actors: 'One, Two' }))

      await expect(getMovie('movie/one')).resolves.toMatchObject({
        id: 'movie/one',
        director: 'Solo Director',
        directors: ['Solo Director'],
        cast: ['One', 'Two'],
      })
      expect(String(fetchMock.mock.calls[0][0])).toContain('/api/movies/movie%2Fone')
    })

    it.each([
      ['missing list', {}],
      ['non-array list', { genres: 'Drama' }],
      ['invalid genre member', { genres: ['Drama', 1] }],
    ])('rejects invalid genre responses with %s', async (_description, body) => {
      stubFetch(jsonResponse(body))
      await expect(getGenres()).rejects.toThrow('The server returned an invalid genres response.')
    })

    it('rejects a failed regular API request', async () => {
      stubFetch(jsonResponse({ error: 'Unavailable' }, 503))
      await expect(getMovie('movie-1')).rejects.toThrow('Request failed (503).')
    })
  })

  describe('comments API unit tests', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it.each([
      ['array payload', [{ _id: 'comment-1', name: 'Sam', comment: 'Great!', createdAt: '2025-01-02' }]],
      ['comments field', { comments: [{ id: 'comment-2', name: 'Lee', text: 'Nice.' }] }],
      ['results field', { results: [{ id: 'comment-3', text: 'Good.' }] }],
      ['data field', { data: [{ id: 'comment-4', text: 'Loved it.' }] }],
      ['unknown payload', { unexpected: true }],
    ])('unwraps comments from %s', async (_description, body) => {
      stubFetch(jsonResponse(body))
      const result = await getComments('movie-1')
      expect(result).toHaveLength(Array.isArray(body) ? 1 : 'unexpected' in body ? 0 : 1)
    })

    it('posts a comment and normalizes a wrapped comment response', async () => {
      const fetchMock = stubFetch(jsonResponse({
        comment: { _id: 'comment-5', name: '  Sam  ', comment: '  Wonderful  ' },
      }, 201))

      await expect(createComment({ movieId: 'movie-1', name: 'Sam', text: 'Wonderful' }))
        .resolves.toMatchObject({ id: 'comment-5', name: '  Sam  ', text: '  Wonderful  ' })
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/comments'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ movie_id: 'movie-1', name: 'Sam', text: 'Wonderful' }),
        }),
      )
    })

    it('normalizes an unwrapped comment response', async () => {
      stubFetch(jsonResponse({ id: 'comment-6', text: 'A single comment.' }))

      await expect(createComment({ movieId: 'movie-1', name: 'Sam', text: 'A single comment.' }))
        .resolves.toMatchObject({ id: 'comment-6', text: 'A single comment.' })
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
