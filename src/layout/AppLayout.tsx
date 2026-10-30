import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bookmark, Clapperboard, Film, LogIn, Search, Sparkles } from 'lucide-react'
import { getGenres, login, logout, register, type AuthSession } from '../api'
import { AppShellContext, type AppShellContextValue } from './AppShellContext'
import '../App.css'

const watchlistStorageKey = 'mosaic.watchlist.v1'
const authStorageKey = 'mosaic.auth.v1'

function getWatchlistStorageKey(userId: string | null): string {
  return userId ? `${watchlistStorageKey}.user.${encodeURIComponent(userId)}` : `${watchlistStorageKey}.guest`
}

function getSavedMovieIds(userId: string | null): string[] {
  try {
    const stored = window.localStorage.getItem(getWatchlistStorageKey(userId))
      ?? (userId === null ? window.localStorage.getItem(watchlistStorageKey) : null)
    if (!stored) return []
    const savedMovieIds: unknown = JSON.parse(stored)
    return Array.isArray(savedMovieIds) ? savedMovieIds.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Record<string, unknown>
  const user = session.user
  if (!user || typeof user !== 'object') return false
  const authUser = user as Record<string, unknown>
  return typeof session.token === 'string'
    && session.token.length > 0
    && typeof authUser.id === 'string'
    && typeof authUser.name === 'string'
    && typeof authUser.email === 'string'
}

function getSavedAuthSession(): AuthSession | null {
  try {
    const stored = window.localStorage.getItem(authStorageKey)
    if (!stored) return null
    const session: unknown = JSON.parse(stored)
    return isAuthSession(session) ? session : null
  } catch {
    return null
  }
}

type AppSidebarProps = Pick<AppShellContextValue, 'genres' | 'savedMovies' | 'showWatchlist' | 'setShowWatchlist' | 'activeGenres' | 'setActiveGenres'> & { authSession: AuthSession | null }

function AppSidebar({ genres, savedMovies, showWatchlist, setShowWatchlist, activeGenres, setActiveGenres, authSession }: AppSidebarProps) {
  const [genreSearch, setGenreSearch] = useState('')
  const visibleGenres = genres.filter((genre) => genre.toLowerCase().includes(genreSearch.trim().toLowerCase()))

  return <aside className="sidebar">
    <NavLink className="brand" to="/" aria-label="Mosaic home"><span className="brand-mark"><Clapperboard size={20} /></span><span>mosaic<span className="brand-period">.</span></span></NavLink>
    <div className="side-label">YOUR SPACE</div>
    <nav className="side-nav" aria-label="Main navigation">
      <NavLink className={({ isActive }) => `nav-link${isActive && !showWatchlist ? ' active' : ''}`} onClick={() => setShowWatchlist(false)} to="/"><Sparkles size={17} /> Discover</NavLink>
      <button className={`nav-link${showWatchlist ? ' active' : ''}`} onClick={() => setShowWatchlist((current) => !current)} type="button"><Bookmark size={17} /> Watchlist <span className="nav-count">{savedMovies.length}</span></button>
    </nav>
    <div className="side-label genre-label">BROWSE BY MOOD</div>
    <section className="genre-picker" aria-label="Genre browser">
      <label className="genre-search"><Search size={14} /><input aria-label="Search genres" onChange={(event) => setGenreSearch(event.target.value)} placeholder="Search genres" type="search" value={genreSearch} /></label>
      <nav className="genre-nav" aria-label="Browse by genre">
        <button aria-pressed={activeGenres.length === 0} className={`genre-link${activeGenres.length === 0 ? ' selected' : ''}`} onClick={() => setActiveGenres([])} type="button"><span className="genre-dot" />All films</button>
        {visibleGenres.map((genre) => <button aria-pressed={activeGenres.includes(genre)} className={`genre-link${activeGenres.includes(genre) ? ' selected' : ''}`} key={genre} onClick={() => setActiveGenres((current) => current.includes(genre) ? current.filter((selectedGenre) => selectedGenre !== genre) : [...current, genre])} type="button"><span className={`genre-dot dot-${genre.toLowerCase()}`} />{genre}</button>)}
        {visibleGenres.length === 0 && <span className="genre-no-results">No matching genres</span>}
      </nav>
    </section>
    <div className="sidebar-note"><span className="note-icon"><Film size={16} /></span><p>Your next favorite is out there.</p><span>Keep looking.</span></div>
    <div className="profile-chip"><div className="profile-avatar">{authSession?.user.name.charAt(0).toUpperCase() || 'M'}</div><div><strong>{authSession?.user.name || 'Movie lover'}</strong><span>{authSession?.user.email || 'Guest profile'}</span></div><span className="profile-caret">⌄</span></div>
  </aside>
}

function AppTopbar({ search, setSearch, authSession, onAuthSessionChange }: {
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  authSession: AuthSession | null
  onAuthSessionChange: (session: AuthSession | null) => void
}) {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authView, setAuthView] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function closeMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        setMenuOpen(false)
      } else if (event instanceof MouseEvent && !menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeMenu)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    }
  }, [menuOpen])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')
    try {
      const session = await login(email.trim(), password)
      onAuthSessionChange(session)
      setPassword('')
      setConfirmPassword('')
      try {
        window.localStorage.setItem(authStorageKey, JSON.stringify(session))
      } catch {
        setError('You are signed in, but this browser could not save your session.')
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 4 || trimmedUsername.length > 25) {
      setError('Username must be between 4 and 25 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await register(trimmedUsername, email.trim(), password)
      setAuthView('login')
      setUsername('')
      setPassword('')
      setConfirmPassword('')
      setSuccessMessage('Account created successfully. Please log in.')
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : 'Could not create your account.')
    } finally {
      setLoading(false)
    }
  }

  async function submitLogout() {
    if (!authSession) return
    setLoading(true)
    setError('')
    let logoutError = ''
    try {
      await logout(authSession.token)
    } catch (requestError) {
      logoutError = `Signed out here, but the server could not end the session: ${requestError instanceof Error ? requestError.message : 'Request failed.'}`
    } finally {
      onAuthSessionChange(null)
      try {
        window.localStorage.removeItem(authStorageKey)
      } catch {
        logoutError = 'Signed out, but this browser could not clear the saved session.'
      }
      setError(logoutError)
      setLoading(false)
    }
  }

  const pageName = pathname === '/' ? 'Discover' : pathname.startsWith('/movies/') ? 'Film details' : 'Page'

  return <header className="topbar">
    <div className="breadcrumb"><span>YOUR SPACE</span><b>/</b> {pageName}</div>
    <label className="search-box"><Search size={17} /><input aria-label="Search movies" onChange={(event) => setSearch(event.target.value)} placeholder="Find a film, director..." type="search" value={search} /><kbd>/</kbd></label>
    <div className="account-menu" ref={menuRef}>
      <button aria-controls="account-dropdown" aria-expanded={menuOpen} className="avatar-small" onClick={() => { setMenuOpen((open) => !open); setError('') }} type="button" aria-label={authSession ? `Account menu for ${authSession.user.name}` : 'Open login menu'}>{authSession ? authSession.user.name.charAt(0).toUpperCase() : <LogIn aria-hidden="true" size={17} />}</button>
      {menuOpen && <section className="account-dropdown" id="account-dropdown" aria-label="Account menu">{authSession ? <>
        <div className="account-heading"><strong>{authSession.user.name}</strong><span>{authSession.user.email}</span></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="account-action" disabled={loading} onClick={submitLogout} type="button">{loading ? 'Signing out…' : 'Log out'}</button>
      </> : authView === 'register' ? <form className="account-form" onSubmit={submitRegistration}>
        <div className="account-heading"><strong>Create an account</strong><span>Join Mosaic to save your favorites</span></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <label>Username<input autoComplete="username" maxLength={25} minLength={4} onChange={(event) => setUsername(event.target.value)} required type="text" value={username} /></label>
        <label>Email<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
        <label>Password<input autoComplete="new-password" maxLength={100} minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
        <label>Confirm password<input autoComplete="new-password" maxLength={100} minLength={6} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label>
        <button className="account-action" disabled={loading} type="submit">{loading ? 'Creating account…' : 'Create account'}</button>
        <button className="account-switch" onClick={() => { setAuthView('login'); setUsername(''); setPassword(''); setConfirmPassword(''); setError(''); setSuccessMessage('') }} type="button">Already have an account? Log in</button>
      </form> : <form className="account-form" onSubmit={submitLogin}>
        <div className="account-heading"><strong>Welcome back</strong><span>Sign in to your account</span></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <label>Email<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
        <label>Password<input autoComplete="current-password" minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
        {successMessage && <p className="auth-success" role="status">{successMessage}</p>}
        <button className="account-action" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Log in'}</button>
        <button className="account-switch" onClick={() => { setAuthView('register'); setPassword(''); setError(''); setSuccessMessage('') }} type="button">Don’t have an account? Create one</button>
      </form>}</section>}
    </div>
  </header>
}

export default function AppLayout() {
  const [search, setSearch] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [genresError, setGenresError] = useState('')
  const [activeGenres, setActiveGenres] = useState<string[]>([])
  const [sortByRating, setSortByRating] = useState(true)
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [authSession, setAuthSession] = useState<AuthSession | null>(getSavedAuthSession)
  const [savedMovies, setSavedMovies] = useState<string[]>(() => getSavedMovieIds(authSession?.user.id ?? null))

  useEffect(() => {
    let active = true
    getGenres().then((results) => {
      if (active) {
        setGenres(results)
        setGenresError('')
      }
    }).catch((error: unknown) => {
      if (active) {
        setGenresError(error instanceof Error ? `Could not load genres: ${error.message}` : 'Could not load genres.')
      }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(getWatchlistStorageKey(authSession?.user.id ?? null), JSON.stringify(savedMovies))
    } catch {
      return
    }
  }, [authSession, savedMovies])

  function toggleSaved(movieId: string) {
    setSavedMovies((current) => current.includes(movieId) ? current.filter((id) => id !== movieId) : [...current, movieId])
  }

  function changeAuthSession(session: AuthSession | null) {
    setSavedMovies(getSavedMovieIds(session?.user.id ?? null))
    setAuthSession(session)
  }

  const shellContext: AppShellContextValue = {
    search,
    setSearch,
    genres,
    genresError,
    activeGenres,
    setActiveGenres,
    sortByRating,
    setSortByRating,
    showWatchlist,
    setShowWatchlist,
    savedMovies,
    toggleSaved,
  }

  return <AppShellContext.Provider value={shellContext}>
    <div className="app-shell">
      <AppSidebar
        genres={genres}
        savedMovies={savedMovies}
        showWatchlist={showWatchlist}
        setShowWatchlist={setShowWatchlist}
        activeGenres={activeGenres}
        setActiveGenres={setActiveGenres}
        authSession={authSession}
      />
      <main id="top" className="main-content">
        <AppTopbar search={search} setSearch={setSearch} authSession={authSession} onAuthSessionChange={changeAuthSession} />
        <Outlet />
      </main>
    </div>
  </AppShellContext.Provider>
}
