import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

describe('movie watchlist', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API unavailable')))
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('adds a movie to the watchlist and displays it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add The Quiet Between to watchlist' }))

    expect(screen.getByRole('button', { name: 'Remove The Quiet Between from watchlist' }))
      .toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /Watchlist/ }))

    expect(screen.getByRole('heading', { name: 'Your watchlist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'The Quiet Between' })).toBeVisible()
  })

  it('restores saved movies after the app is reopened', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add The Quiet Between to watchlist' }))
    unmount()
    render(<App />)

    expect(screen.getByRole('button', { name: 'Remove The Quiet Between from watchlist' }))
      .toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /Watchlist/ }))
    expect(screen.getByRole('button', { name: 'The Quiet Between' })).toBeVisible()
  })
})