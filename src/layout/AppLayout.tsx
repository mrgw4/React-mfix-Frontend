import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bookmark, Clapperboard, Film, LogIn, Search, Sparkles, Star } from 'lucide-react'
import { getGenres, login, logout, register, type AuthSession } from '../api'
import { AppShellContext, type AppShellContextValue } from './AppShellContext'
import '../App.css'

const watchlistStorageKey = 'mosaic.watchlist.v1'
const authStorageKey = 'mosaic.auth.v1'

function getSavedMovieIds(): string[] {
  try {
    const stored = window.localStorage.getItem(watchlistStorageKey)
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

type AppSidebarProps = Pick<AppShellContextValue, 'genres' | 'savedMovies' | 'showWatchlist' | 'setShowWatchlist' | 'setSortByRating' | 'activeGenre' | 'setActiveGenre'> & { authSession: AuthSession | null }

function AppSidebar({ genres, savedMovies, showWatchlist, setShowWatchlist, setSortByRating, activeGenre, setActiveGenre, authSession }: AppSidebarProps) {
  return <aside className="sidebar">
    <NavLink className="brand" to="/" aria-label="Mosaic home"><span className="brand-mark"><Clapperboard size={20} /></span><span>mosaic<span className="brand-period">.</span></span></NavLink>
    <div className="side-label">YOUR SPACE</div>
    <nav className="side-nav" aria-label="Main navigation">
      <NavLink className={({ isActive }) => `nav-link${isActive && !showWatchlist ? ' active' : ''}`} to="/"><Sparkles size={17} /> Discover</NavLink>
      <button className="nav-link" onClick={() => { setSortByRating(true); setShowWatchlist(false) }} type="button"><Star size={17} /> Top rated</button>
      <button className={`nav-link${showWatchlist ? ' active' : ''}`} onClick={() => setShowWatchlist((current) => !current)} type="button"><Bookmark size={17} /> Watchlist <span className="nav-count">{savedMovies.length}</span></button>
    </nav>
    <div className="side-label genre-label">BROWSE BY MOOD</div>
    <nav className="genre-nav" aria-label="Browse by genre">
      {genres.map((genre) => <button className={`genre-link${activeGenre === genre ? ' selected' : ''}`} key={genre} onClick={() => { setActiveGenre(activeGenre === genre ? 'All films' : genre); setShowWatchlist(false) }} type="button"><span className={`genre-dot dot-${genre.toLowerCase()}`} />{genre}</button>)}
    </nav>
    <div className="sidebar-note"><span className="note-icon"><Film size={16} /></span><p>Your next favorite is out there.</p><span>Keep looking.</span></div>
    <div className="profile-chip"><div className="profile-avatar">{authSession?.user.name.charAt(0).toUpperCase() || 'M'}</div><div><strong>{authSession?.user.name || 'Movie lover'}</strong><span>{authSession?.user.email || 'Guest profile'}</span></div><span className="profile-caret">⌄</span></div>
  </aside>
}

function AppTopbar({ search, setSearch, authSession, setAuthSession }: {
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  authSession: AuthSession | null
  setAuthSession: Dispatch<SetStateAction<AuthSession | null>>
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
      setAuthSession(session)
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
      setAuthSession(null)
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
  const [activeGenre, setActiveGenre] = useState('All films')
  const [sortByRating, setSortByRating] = useState(false)
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [savedMovies, setSavedMovies] = useState<string[]>(getSavedMovieIds)
  const [authSession, setAuthSession] = useState<AuthSession | null>(getSavedAuthSession)

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
      window.localStorage.setItem(watchlistStorageKey, JSON.stringify(savedMovies))
    } catch {
      return
    }
  }, [savedMovies])

  function toggleSaved(movieId: string) {
    setSavedMovies((current) => current.includes(movieId) ? current.filter((id) => id !== movieId) : [...current, movieId])
  }

  const shellContext: AppShellContextValue = {
    search,
    setSearch,
    genres,
    genresError,
    activeGenre,
    setActiveGenre,
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
        setSortByRating={setSortByRating}
        activeGenre={activeGenre}
        setActiveGenre={setActiveGenre}
        authSession={authSession}
      />
      <main id="top" className="main-content">
        <AppTopbar search={search} setSearch={setSearch} authSession={authSession} setAuthSession={setAuthSession} />
        <Outlet />
      </main>
    </div>
  </AppShellContext.Provider>
}
