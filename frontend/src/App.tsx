import { AnimatePresence } from 'framer-motion'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { FullScreenLoader, GuestRoute, RoleRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import LoginPage from './pages/LoginPage'

const SignupPage = lazy(() => import('./pages/SignupPage'))
const RolePage = lazy(() => import('./pages/RolePage'))

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<FullScreenLoader />}>
        <Routes location={location} key={location.pathname.split('/')[1]}>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
          <Route path="/:roleSlug/*" element={<RoleRoute><RolePage /></RoleRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AnimatedRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
