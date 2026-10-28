import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'

export type AppShellContextValue = {
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  genres: string[]
  genresError: string
  activeGenres: string[]
  setActiveGenres: Dispatch<SetStateAction<string[]>>
  sortByRating: boolean
  setSortByRating: Dispatch<SetStateAction<boolean>>
  showWatchlist: boolean
  setShowWatchlist: Dispatch<SetStateAction<boolean>>
  savedMovies: string[]
  toggleSaved: (movieId: string) => void
}

export const AppShellContext = createContext<AppShellContextValue | null>(null)

export function useAppShell() {
  const context = useContext(AppShellContext)
  if (!context) throw new Error('useAppShell must be used inside the app layout.')
  return context
}
