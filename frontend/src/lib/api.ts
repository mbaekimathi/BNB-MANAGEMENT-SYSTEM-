import axios, { AxiosError } from 'axios'

export type Role =
  | 'admin'
  | 'company_manager'
  | 'it_support'
  | 'company_store_manager'
  | 'branch_store_manager'
  | 'branch_manager'
  | 'branch_receptionist'
  | 'branch_employee'

export interface BranchInfo {
  id: number
  name: string
  code: string
  location: string
  phone: string
  email: string
  photo: string | null
  /** Workspace theme name the branch picked for this user's role, if any. */
  theme: string | null
}

export interface Employee {
  id: number
  code: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  photo: string | null
  role: Role
  role_label: string
  status: 'pending' | 'active' | 'suspended'
  status_label: string
  branch: number | null
  branch_name: string | null
  branch_detail: BranchInfo | null
  last_login: string | null
  created_at: string
}

export interface LoginResponse {
  access: string
  refresh: string
  user: Employee
}

export interface SignupPayload {
  first_name: string
  last_name: string
  email: string
  phone: string
  code: string
  password: string
  confirm_password: string
  photo: File | null
}

const ACCESS_KEY = 'haven.access'
const REFRESH_KEY = 'haven.refresh'

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY) ?? sessionStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY)
  },
  save(access: string, refresh: string, remember?: boolean) {
    const persistent = remember ?? localStorage.getItem(REFRESH_KEY) !== null
    const store = persistent ? localStorage : sessionStorage
    this.clear()
    store.setItem(ACCESS_KEY, access)
    store.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    for (const s of [localStorage, sessionStorage]) {
      s.removeItem(ACCESS_KEY)
      s.removeItem(REFRESH_KEY)
    }
  },
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const access = tokens.access
  if (access) config.headers.Authorization = `Bearer ${access}`
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshAccess(): Promise<string | null> {
  const refresh = tokens.refresh
  if (!refresh) return null
  try {
    const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh/`, { refresh })
    tokens.save(data.access, data.refresh ?? refresh)
    return data.access as string
  } catch {
    tokens.clear()
    return null
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/login')) {
      original._retry = true
      refreshing ??= refreshAccess().finally(() => (refreshing = null))
      const access = await refreshing
      if (access) {
        original.headers.Authorization = `Bearer ${access}`
        return api(original)
      }
    }
    return Promise.reject(error)
  },
)

export type FieldErrors = Record<string, string>

/**
 * De-dupes identical in-flight GETs — several widgets on a page often mount the
 * same list at once (e.g. stats + charts both fetch bookings). Once a request
 * settles, the next call goes out fresh, so data never goes stale.
 */
export function share<P = void, T = unknown>(load: (params: P) => Promise<T>): (params?: P) => Promise<T> {
  const inflight = new Map<string, Promise<T>>()
  return (params?: P) => {
    const key = JSON.stringify(params ?? null)
    let p = inflight.get(key)
    if (!p) {
      p = load(params as P).finally(() => inflight.delete(key))
      inflight.set(key, p)
    }
    return p
  }
}

/** Turns a DRF error response into a top-level message plus per-field messages. */
export function parseApiError(err: unknown): { message: string; fields: FieldErrors } {
  const fields: FieldErrors = {}
  if (axios.isAxiosError(err)) {
    if (!err.response) return { message: 'Cannot reach the server. Check your connection and try again.', fields }
    if (err.response.status === 429) return { message: 'Too many attempts. Please wait a minute and try again.', fields }
    const data = err.response.data as Record<string, unknown> | undefined
    let message = ''
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        const text = Array.isArray(value) ? String(value[0]) : String(value)
        if (key === 'detail' || key === 'non_field_errors') message = text
        else if (key !== 'code' || Array.isArray(value)) fields[key] = text
      }
    }
    return { message: message || (Object.keys(fields).length ? 'Please fix the highlighted fields.' : 'Something went wrong. Please try again.'), fields }
  }
  return { message: 'Something went wrong. Please try again.', fields }
}
