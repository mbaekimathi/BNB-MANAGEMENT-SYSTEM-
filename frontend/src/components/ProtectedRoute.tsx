import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleFromSlug, rolePath } from '../lib/roles'
import { PageLoader } from './PageLoader'

export function FullScreenLoader() {
  return <PageLoader />
}

/** Only lets an employee open their own role's page; anyone else is sent to theirs (or to login). */
export function RoleRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { roleSlug } = useParams()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (roleFromSlug(roleSlug) !== user.role) return <Navigate to={rolePath(user.role)} replace />
  return children
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (user) return <Navigate to={rolePath(user.role)} replace />
  return children
}
