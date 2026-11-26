import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, SESSION_EXPIRED, tokens, type Employee, type LoginResponse, type SignupPayload } from '../lib/api'

interface AuthState {
  user: Employee | null
  loading: boolean
  login: (code: string, password: string, remember: boolean) => Promise<Employee>
  signup: (payload: SignupPayload) => Promise<{ message: string; user: Employee }>
  logout: () => Promise<void>
  /** Re-fetch /auth/me/ — e.g. after branch settings change the user's theme pick. */
  reload: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(() => Boolean(tokens.refresh))

  useEffect(() => {
    if (!tokens.refresh) return
    api
      .get<Employee>('/auth/me/')
      .then((res) => setUser(res.data))
      .catch(() => tokens.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (code: string, password: string, remember: boolean) => {
    const { data } = await api.post<LoginResponse>('/auth/login/', { code, password, remember_me: remember })
    tokens.save(data.access, data.refresh, remember)
    setUser(data.user)
    return data.user
  }, [])

  const signup = useCallback(async (payload: SignupPayload) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(payload)) {
      if (value !== null) form.append(key, value)
    }
    const { data } = await api.post<{ message: string; user: Employee }>('/auth/register/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  }, [])

  const logout = useCallback(async () => {
    const refresh = tokens.refresh
    /** Call logout before clearing — the request needs the access token
     *  attached for the refresh token to be blacklisted server-side. */
    if (refresh) await api.post('/auth/logout/', { refresh }).catch(() => undefined)
    tokens.clear()
    setUser(null)
  }, [])

  /** Session died mid-use (refresh rejected or no token left) — log the client
   *  out instead of showing the raw 401 error; RoleRoute then sends them to /login. */
  useEffect(() => {
    const onExpired = () => void logout()
    window.addEventListener(SESSION_EXPIRED, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED, onExpired)
  }, [logout])

  const reload = useCallback(async () => {
    const { data } = await api.get<Employee>('/auth/me/')
    setUser(data)
  }, [])

  const value = useMemo(() => ({ user, loading, login, signup, logout, reload }), [user, loading, login, signup, logout, reload])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
