export type Movie = {
  id: string
  title: string
  commentCount: number | null
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
  tomatoes: {
    viewerMeter: number | null
    viewerRating: number | null
    viewerNumReviews: number | null
    criticMeter: number | null
    criticRating: number | null
    criticNumReviews: number | null
  }
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
  tomatoesMeterMin?: number
  tomatoesMeterMax?: number
  tomatoesRatingMin?: number
  tomatoesRatingMax?: number
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
  | 'tomatoesMeterMin'
  | 'tomatoesMeterMax'
  | 'tomatoesRatingMin'
  | 'tomatoesRatingMax'
  | 'sort'
  | 'order'
>
export type MovieSort = NonNullable<MovieQuery['sort']>
export type MovieSortOrder = NonNullable<MovieQuery['order']>

export type MovieComment = { id: string; name: string; text: string; date: string }
export type MovieCommentPage = {
  comments: MovieComment[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}
type CommentInput = { movieId: string; text: string }
export type AuthUser = { id: string; name: string; email: string }
export type AuthSession = { token: string; user: AuthUser }
export const sessionExpiredEventName = 'mosaic:session-expired'
export const sessionExpiredMessage = 'Your session has expired or is no longer valid. Please sign in again.'

export class SessionExpiredError extends Error {
  constructor() {
    super(sessionExpiredMessage)
    this.name = 'SessionExpiredError'
  }
}

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
    const message = asRecord(payload).error
    if (response.status === 401 && new Headers(headers).has('Authorization')) {
      window.dispatchEvent(new Event(sessionExpiredEventName))
      throw new SessionExpiredError()
    }
    if (response.status === 401 && unauthorizedMessage) throw new Error(unauthorizedMessage)
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

function asOptionalNumber(value: unknown): number | null {
  if (
    (typeof value !== 'number' && typeof value !== 'string')
    || value === ''
    || (typeof value === 'string' && !value.trim())
  ) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeMovie(value: unknown, index: number): Movie {
  const movie = asRecord(value)
  const imdb = asRecord(movie.imdb)
  const tomatoes = asRecord(movie.tomatoes)
  const tomatoesViewer = asRecord(tomatoes.viewer)
  const tomatoesCritic = asRecord(tomatoes.critic)
  const metacritic = Number(movie.metacritic)
  const directors = asStringArray(movie.directors ?? movie.director)
  return {
    id: asString(movie._id ?? movie.id, `movie-${index}`),
    title: asString(movie.title, 'Untitled film'),
    commentCount: asOptionalNumber(movie.num_mflix_comments),
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
    tomatoes: {
      viewerMeter: asOptionalNumber(tomatoesViewer.meter),
      viewerRating: asOptionalNumber(tomatoesViewer.rating),
      viewerNumReviews: asOptionalNumber(tomatoesViewer.numReviews),
      criticMeter: asOptionalNumber(tomatoesCritic.meter),
      criticRating: asOptionalNumber(tomatoesCritic.rating),
      criticNumReviews: asOptionalNumber(tomatoesCritic.numReviews),
    },
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
  for (const key of [
    'yearMin', 'yearMax', 'runtimeMin', 'runtimeMax', 'imdbRatingMin', 'imdbRatingMax',
    'metacriticMin', 'metacriticMax', 'tomatoesMeterMin', 'tomatoesMeterMax',
    'tomatoesRatingMin', 'tomatoesRatingMax',
  ] as const) {
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

export async function getComments(
  movieId: string,
  page = 1,
  limit = 20,
  userId?: string,
): Promise<MovieCommentPage> {
  const query: Record<string, string> = { movieId, page: String(page), limit: String(limit) }
  if (userId) query.userId = userId
  const payload = await request<unknown>(endpointUrl(commentsEndpoint, query))
  const comments = unwrapList(payload).map(normalizeComment)
  const pagination = asRecord(asRecord(payload).pagination)

  return {
    comments,
    pagination: {
      page: typeof pagination.page === 'number' ? pagination.page : page,
      limit: typeof pagination.limit === 'number' ? pagination.limit : limit,
      total: typeof pagination.total === 'number' ? pagination.total : comments.length,
      pages: typeof pagination.pages === 'number' ? pagination.pages : comments.length ? 1 : 0,
      hasNextPage: typeof pagination.hasNextPage === 'boolean' ? pagination.hasNextPage : false,
      hasPrevPage: typeof pagination.hasPrevPage === 'boolean' ? pagination.hasPrevPage : false,
    },
  }
}

export async function getOwnedCommentIds(movieId: string, userId: string): Promise<Set<string>> {
  const ownedCommentIds = new Set<string>()
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await getComments(movieId, page, 100, userId)
    result.comments.forEach((comment) => ownedCommentIds.add(comment.id))
    hasNextPage = result.pagination.hasNextPage
    page += 1
  }

  return ownedCommentIds
}

export async function createComment(input: CommentInput, token: string): Promise<MovieComment> {
  const payload = await authRequest<unknown>(commentsEndpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ movie_id: input.movieId, text: input.text }),
  })
  const record = asRecord(payload)
  return normalizeComment(record.comment ?? record, Date.now())
}

export async function deleteComment(commentId: string, token: string): Promise<void> {
  await authRequest<unknown>(`${commentsEndpoint.replace(/\/$/, '')}/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function updateComment(commentId: string, text: string, token: string): Promise<MovieComment> {
  const payload = await authRequest<unknown>(`${commentsEndpoint.replace(/\/$/, '')}/${encodeURIComponent(commentId)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  })
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