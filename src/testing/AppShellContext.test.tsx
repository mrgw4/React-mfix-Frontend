import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useAppShell } from '../layout/AppShellContext'

function ContextConsumer() {
  useAppShell()
  return null
}

it('throws when the app-shell context is used outside its provider', () => {
  expect(() => render(<ContextConsumer />))
    .toThrow('useAppShell must be used inside the app layout.')
})
