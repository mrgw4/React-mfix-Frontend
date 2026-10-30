export type Movie = {
  id: string
  title: string
  year: number
  genres: string[]
  rating: number
  runtime: number
  plot: string
  plotForFiltering: string
  director: string
  directors: string[]
  cast: string[]
  rated: string
  type: string
  metacritic: number | null
  released: string
  posterUrl: string
}

export type MoviePage = {
  movies: Movie[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export type MovieQuery = {
  page?: number
  genres?: string[]
  search?: string
  sortByRating?: boolean
  title?: string
  plot?: string
  directors?: string
  cast?: string
  rated?: string
  type?: string
  yearMin?: number
  yearMax?: number
  runtimeMin?: number
  runtimeMax?: number
  imdbRatingMin?: number
  imdbRatingMax?: number
  metacriticMin?: number
  metacriticMax?: number
  sort?: 'title' | 'year' | 'runtime' | 'released' | 'metacritic' | 'imdbRating' | 'tomatoesMeter' | 'tomatoesRating'
  order?: 'asc' | 'desc'
}

export type AdvancedMovieFilters = Pick<MovieQuery,
  | 'title'
  | 'plot'
  | 'directors'
  | 'cast'
  | 'rated'
  | 'type'
  | 'yearMin'
  | 'yearMax'
  | 'runtimeMin'
  | 'runtimeMax'
  | 'imdbRatingMin'
  | 'imdbRatingMax'
  | 'metacriticMin'
  | 'metacriticMax'
  | 'sort'
  | 'order'
>
export type MovieSort = NonNullable<MovieQuery['sort']>
export type MovieSortOrder = NonNullable<MovieQuery['order']>

export type MovieComment = { id: string; name: string; text: string; date: string }
type CommentInput = { movieId: string; name: string; text: string }
export type AuthUser = { id: string; name: string; email: string }
export type AuthSession = { token: string; user: AuthUser }

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const moviesEndpoint = import.meta.env.VITE_MOVIES_ENDPOINT ?? '/api/movies'
const commentsEndpoint = import.meta.env.VITE_COMMENTS_ENDPOINT ?? '/api/comments'
const usersEndpoint = import.meta.env.VITE_USERS_ENDPOINT ?? '/api/users'

function endpointUrl(endpoint: string, query?: Record<string, string>) {
  const url = new URL(`${baseUrl}${endpoint}`, window.location.origin)
  if (query) Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.toString()
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers
  const response = await fetch(url, { ...init, headers })
  if (!response.ok) throw new Error(`Request failed (${response.status}).`)
  return response.json() as Promise<T>
}

async function authRequest<T>(endpoint: string, init: RequestInit, unauthorizedMessage?: string): Promise<T> {
  const headers = init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers
  const response = await fetch(endpointUrl(endpoint), { ...init, headers })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    if (response.ok) throw new Error('The server returned an invalid response.')
  }
  if (!response.ok) {
    if (response.status === 401 && unauthorizedMessage) throw new Error(unauthorizedMessage)
    const message = asRecord(payload).error
    throw new Error(typeof message === 'string' ? message : `Request failed (${response.status}).`)
  }
  return payload as T
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => asString(item)).filter(Boolean)
  return typeof value === 'string' ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
}

function normalizeMovie(value: unknown, index: number): Movie {
  const movie = asRecord(value)
  const imdb = asRecord(movie.imdb)
  const metacritic = Number(movie.metacritic)
  const directors = asStringArray(movie.directors ?? movie.director)
  return {
    id: asString(movie._id ?? movie.id, `movie-${index}`),
    title: asString(movie.title, 'Untitled film'),
    year: Number(movie.year) || 0,
    genres: asStringArray(movie.genres ?? movie.genre),
    rating: Number(imdb.rating ?? movie.rating ?? movie.vote_average) || 0,
    runtime: Number(movie.runtime) || 0,
    plot: asString(movie.fullplot ?? movie.plot ?? movie.overview),
    plotForFiltering: asString(movie.plot),
    director: asString(movie.director ?? directors[0]),
    directors,
    cast: asStringArray(movie.cast ?? movie.actors),
    rated: asString(movie.rated),
    type: asString(movie.type),
    metacritic: Number.isFinite(metacritic) && movie.metacritic !== null && movie.metacritic !== undefined ? metacritic : null,
    released: asString(movie.released),
    posterUrl: asString(movie.posterUrl ?? movie.poster_url ?? movie.poster ?? movie.image),
  }
}

function normalizeComment(value: unknown, index: number): MovieComment {
  const comment = asRecord(value)
  return { id: asString(comment._id ?? comment.id, `comment-${index}`), name: asString(comment.name, 'Movie fan'), text: asString(comment.text ?? comment.comment), date: asString(comment.date ?? comment.createdAt) }
}

function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  const record = asRecord(payload)
  for (const key of ['movies', 'comments', 'results', 'data']) if (Array.isArray(record[key])) return record[key] as unknown[]
  return []
}

export async function getMovies(query: MovieQuery = {}): Promise<MoviePage> {
  const params: Record<string, string> = {
    page: String(query.page ?? 1),
    limit: '30',
    sort: query.sortByRating ? 'imdbRating' : 'year',
    order: 'desc',
  }
  const search = query.search?.trim()
  if (search) params.search = search
  if (query.genres?.length) params.genres = query.genres.join(',')
  for (const key of ['title', 'plot', 'directors', 'cast', 'rated', 'type'] as const) {
    const value = query[key]?.trim()
    if (value) params[key] = value
  }
  for (const key of ['yearMin', 'yearMax', 'runtimeMin', 'runtimeMax', 'imdbRatingMin', 'imdbRatingMax', 'metacriticMin', 'metacriticMax'] as const) {
    const value = query[key]
    if (value !== undefined) params[key] = String(value)
  }
  if (query.sort) params.sort = query.sort
  else params.sort = query.sortByRating ? 'imdbRating' : 'year'
  if (query.order) params.order = query.order
  else params.order = 'desc'

  const payload = asRecord(await request<unknown>(endpointUrl(moviesEndpoint, params)))
  const pagination = asRecord(payload.pagination)
  if (
    !Array.isArray(payload.data)
    || typeof pagination.page !== 'number'
    || typeof pagination.limit !== 'number'
    || typeof pagination.total !== 'number'
    || typeof pagination.pages !== 'number'
    || typeof pagination.hasNextPage !== 'boolean'
    || typeof pagination.hasPrevPage !== 'boolean'
  ) {
    throw new Error('The server returned an invalid movie list response.')
  }

  return {
    movies: payload.data.map(normalizeMovie),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: pagination.pages,
      hasNextPage: pagination.hasNextPage,
      hasPrevPage: pagination.hasPrevPage,
    },
  }
}

export async function getMovie(id: string): Promise<Movie> {
  const endpoint = `${moviesEndpoint.replace(/\/$/, '')}/${encodeURIComponent(id)}`
  return normalizeMovie(await request<unknown>(endpointUrl(endpoint)), 0)
}

export async function getGenres(): Promise<string[]> {
  const endpoint = `${moviesEndpoint.replace(/\/$/, '')}/genres`
  const payload = await request<unknown>(endpointUrl(endpoint))
  const genres = asRecord(payload).genres
  if (!Array.isArray(genres) || genres.some((genre) => typeof genre !== 'string')) {
    throw new Error('The server returned an invalid genres response.')
  }
  return [...new Set(genres.map((genre) => genre.trim()).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second))
}

export async function getComments(movieId: string): Promise<MovieComment[]> {
  const payload = await request<unknown>(endpointUrl(commentsEndpoint, { movieId }))
  return unwrapList(payload).map(normalizeComment)
}

export async function createComment(input: CommentInput): Promise<MovieComment> {
  const payload = await request<unknown>(endpointUrl(commentsEndpoint), { method: 'POST', body: JSON.stringify({ movie_id: input.movieId, name: input.name, text: input.text }) })
  const record = asRecord(payload)
  return normalizeComment(record.comment ?? record, Date.now())
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const payload = await authRequest<unknown>(`${usersEndpoint.replace(/\/$/, '')}/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, 'Invalid username or password.')
  const record = asRecord(payload)
  const user = asRecord(record.user)
  if (
    typeof record.token !== 'string'
    || !record.token
    || typeof user.id !== 'string'
    || typeof user.name !== 'string'
    || typeof user.email !== 'string'
  ) {
    throw new Error('The server returned an invalid login response.')
  }
  return { token: record.token, user: { id: user.id, name: user.name, email: user.email } }
}

export async function register(name: string, email: string, password: string): Promise<void> {
  await authRequest<unknown>(usersEndpoint.replace(/\/$/, ''), {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
}

export function logout(token: string): Promise<{ message: string }> {
  return authRequest<{ message: string }>(`${usersEndpoint.replace(/\/$/, '')}/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}