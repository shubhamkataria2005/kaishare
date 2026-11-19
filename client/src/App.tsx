import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/toast/ToastProvider'
import { BrowsePage } from './pages/BrowsePage'
import { ClaimsPage } from './pages/ClaimsPage'
import { ListingDetailPage } from './pages/ListingDetailPage'
import { EditListingPage, NewListingPage } from './pages/ListingFormPage'
import { LoginPage } from './pages/LoginPage'
import { MyListingsPage } from './pages/MyListingsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<RequireAuth><BrowsePage /></RequireAuth>} />
              <Route path="/listings/new" element={<RequireAuth roles={['donor']}><NewListingPage /></RequireAuth>} />
              <Route path="/listings/:id" element={<RequireAuth><ListingDetailPage /></RequireAuth>} />
              <Route path="/listings/:id/edit" element={<RequireAuth roles={['donor', 'admin']}><EditListingPage /></RequireAuth>} />
              <Route path="/my-listings" element={<RequireAuth roles={['donor']}><MyListingsPage /></RequireAuth>} />
              <Route path="/claims" element={<RequireAuth><ClaimsPage /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
