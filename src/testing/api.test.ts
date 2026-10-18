import { afterEach, describe, expect, it, vi } from 'vitest'
import { login, logout, register, type AuthSession } from '../api'

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
