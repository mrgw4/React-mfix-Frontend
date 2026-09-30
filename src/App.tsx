import { BrowserRouter, Route, Routes } from 'react-router-dom'
import DiscoverPage from './pages/DiscoverPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DiscoverPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App