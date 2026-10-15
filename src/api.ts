export type Movie = {
  id: string
  title: string
  year: number
  genres: string[]
  rating: number
  runtime: number
  plot: string
  director: string
  cast: string[]
  posterUrl: string
}

export type MovieComment = { id: string; name: string; text: string; date: string }
type CommentInput = { movieId: string; name: string; text: string }

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const moviesEndpoint = import.meta.env.VITE_MOVIES_ENDPOINT ?? '/api/movies'
const commentsEndpoint = import.meta.env.VITE_COMMENTS_ENDPOINT ?? '/api/comments'

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
  return {
    id: asString(movie._id ?? movie.id, `movie-${index}`),
    title: asString(movie.title, 'Untitled film'),
    year: Number(movie.year) || 0,
    genres: asStringArray(movie.genres ?? movie.genre),
    rating: Number(imdb.rating ?? movie.rating ?? movie.vote_average) || 0,
    runtime: Number(movie.runtime) || 0,
    plot: asString(movie.fullplot ?? movie.plot ?? movie.overview),
    director: asString(movie.director ?? asStringArray(movie.directors)[0]),
    cast: asStringArray(movie.cast ?? movie.actors),
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

export async function getMovies(): Promise<Movie[]> {
  const payload = await request<unknown>(endpointUrl(moviesEndpoint, { limit: '30' }))
  return unwrapList(payload).map(normalizeMovie)
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