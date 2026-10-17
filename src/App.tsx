import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import DiscoverPage from './pages/DiscoverPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DiscoverPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App