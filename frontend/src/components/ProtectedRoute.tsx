import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleFromSlug, rolePath } from '../lib/roles'

export function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f2ec] dark:bg-ink-950">
      <Loader2 className="size-8 animate-spin text-gold-500 dark:text-gold-300" />
    </div>
  )
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
