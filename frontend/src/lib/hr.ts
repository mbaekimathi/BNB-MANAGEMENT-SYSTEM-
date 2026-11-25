import { useCallback, useEffect, useState } from 'react'
import { api, parseApiError, share, type Employee, type Role } from './api'

export interface EmployeeBrief {
  id: number
  code: string
  first_name: string
  last_name: string
  full_name: string
  role: Role
  role_label: string
  photo: string | null
}

export interface HRSummary {
  total: number
  status: Record<Employee['status'], number>
  roles: { value: Role; label: string; count: number }[]
  joined_last_30_days: number
  attendance_today: Record<AttendanceStatus, number>
  on_leave_today: number
  leave_pending: number
  payroll_month: { period: string; entries: number; net_total: string; paid: number }
  recent: Employee[]
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'off'
export interface AttendanceRecord {
  id: number
  employee: EmployeeBrief
  date: string
  status: AttendanceStatus
  status_label: string
  clock_in: string | null
  clock_out: string | null
  /** True when the system ended the shift after an unanswered session check. */
  system_clock_out: boolean
  note: string
}

/** The signed-in staff member's own attendance for today. */
export interface MyAttendance {
  record: AttendanceRecord | null
  server_now: string
}

export type ClockAction = 'check-in' | 'check-out' | 'system-check-out'

export type LeaveType = 'annual' | 'sick' | 'maternity' | 'compassionate' | 'unpaid'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'
export interface LeaveRecord {
  id: number
  employee: EmployeeBrief
  leave_type: LeaveType
  type_label: string
  start_date: string
  end_date: string
  days: number
  reason: string
  status: LeaveStatus
  status_label: string
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

export interface PayrollRecord {
  id: number
  employee: EmployeeBrief
  period: string
  basic_salary: string
  allowances: string
  deductions: string
  net_pay: string
  status: 'draft' | 'paid'
  status_label: string
  paid_at: string | null
}

/** A kind of work a branch manager hands out, e.g. "Room cleaning". */
export interface TaskType {
  id: number
  name: string
  description: string
  open_count: number
  created_at: string
}

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'
export type TaskStatusAction = 'start' | 'complete' | 'cancel'

export interface TaskAssignment {
  id: number
  task_type: TaskType
  employee: EmployeeBrief
  date: string
  start: string | null
  end: string | null
  status: TaskStatus
  status_label: string
  note: string
  assigned_by: string | null
  completed_at: string | null
  created_at: string
}

export const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'off', label: 'Day off' },
]

export const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'annual', label: 'Annual leave' },
  { value: 'sick', label: 'Sick leave' },
  { value: 'maternity', label: 'Maternity / paternity' },
  { value: 'compassionate', label: 'Compassionate leave' },
  { value: 'unpaid', label: 'Unpaid leave' },
]

export type EmployeeEdit = Partial<Pick<Employee, 'first_name' | 'last_name' | 'email' | 'phone' | 'code' | 'role' | 'status'>> & {
  new_password?: string
  branch?: number | null
}

export interface MemberSignup {
  first_name: string
  last_name: string
  email: string
  phone: string
  code: string
  role: Role
  password: string
  confirm_password: string
}

/** Sends employee fields as multipart form data, attaching `photo` when it's a File. */
function memberForm(data: Record<string, unknown>, photo?: File | null) {
  const form = new FormData()
  Object.entries(data).forEach(([k, v]) => v !== undefined && form.append(k, v === null ? '' : String(v)))
  if (photo instanceof File) form.append('photo', photo)
  return form
}

export const hr = {
  summary: share(() => api.get<HRSummary>('/hr/summary/').then((r) => r.data)),
  employees: share((params: Record<string, string> = {}) => api.get<Employee[]>('/hr/employees/', { params }).then((r) => r.data)),
  employeeChoices: share(() => api.get<EmployeeBrief[]>('/hr/employees/choices/').then((r) => r.data)),
  /** `photo`: a File replaces the picture, `null` removes it, `undefined` keeps it. */
  updateEmployee: (id: number, data: EmployeeEdit, photo?: File | null) => {
    if (photo instanceof File) {
      const form = new FormData()
      Object.entries(data).forEach(([k, v]) => v !== undefined && form.append(k, v === null ? '' : String(v)))
      form.append('photo', photo)
      return api.patch<Employee>(`/hr/employees/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    }
    return api.patch<Employee>(`/hr/employees/${id}/`, photo === null ? { ...data, photo: null } : data).then((r) => r.data)
  },
  activate: (id: number, role?: Role, branch?: number | null) =>
    api.post<Employee>(`/hr/employees/${id}/activate/`, { role, branch }).then((r) => r.data),
  suspend: (id: number) => api.post<Employee>(`/hr/employees/${id}/suspend/`).then((r) => r.data),

  /** Branch manager endpoints — scoped to the staff at their own branch. */
  team: share((params: Record<string, string> = {}) => api.get<Employee[]>('/hr/team/', { params }).then((r) => r.data)),
  registerMember: (data: MemberSignup, photo?: File | null) =>
    api.post<Employee>('/hr/team/', memberForm({ ...data }, photo), { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  updateMember: (id: number, data: EmployeeEdit, photo?: File | null) => {
    if (photo instanceof File) {
      return api.patch<Employee>(`/hr/team/${id}/`, memberForm({ ...data }, photo), { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    }
    return api.patch<Employee>(`/hr/team/${id}/`, photo === null ? { ...data, photo: null } : data).then((r) => r.data)
  },
  activateMember: (id: number) => api.post<Employee>(`/hr/team/${id}/activate/`).then((r) => r.data),
  suspendMember: (id: number) => api.post<Employee>(`/hr/team/${id}/suspend/`).then((r) => r.data),
  deleteMember: (id: number) => api.delete(`/hr/team/${id}/`),

  attendance: share((date: string) => api.get<AttendanceRecord[]>('/hr/attendance/', { params: { date } }).then((r) => r.data)),
  addAttendance: (data: Record<string, unknown>) => api.post<AttendanceRecord>('/hr/attendance/', data).then((r) => r.data),
  deleteAttendance: (id: number) => api.delete(`/hr/attendance/${id}/`),

  myAttendance: share(() => api.get<MyAttendance>('/hr/my-attendance/').then((r) => r.data)),
  clock: (action: ClockAction) => api.post<AttendanceRecord>('/hr/my-attendance/', { action }).then((r) => r.data),

  leave: share((status?: LeaveStatus) => api.get<LeaveRecord[]>('/hr/leave/', { params: status ? { status } : {} }).then((r) => r.data)),
  addLeave: (data: Record<string, unknown>) => api.post<LeaveRecord>('/hr/leave/', data).then((r) => r.data),
  decideLeave: (id: number, decision: 'approve' | 'reject') => api.post<LeaveRecord>(`/hr/leave/${id}/${decision}/`).then((r) => r.data),

  payroll: share((period: string) => api.get<PayrollRecord[]>('/hr/payroll/', { params: { period } }).then((r) => r.data)),
  addPayroll: (data: Record<string, unknown>) => api.post<PayrollRecord>('/hr/payroll/', data).then((r) => r.data),
  payPayroll: (id: number) => api.post<PayrollRecord>(`/hr/payroll/${id}/pay/`).then((r) => r.data),
  deletePayroll: (id: number) => api.delete(`/hr/payroll/${id}/`),

  /** Branch manager endpoints — task types and assignments scoped to their branch. */
  taskTypes: share(() => api.get<TaskType[]>('/hr/task-types/').then((r) => r.data)),
  addTaskType: (data: { name: string; description: string }) => api.post<TaskType>('/hr/task-types/', data).then((r) => r.data),
  updateTaskType: (id: number, data: { name: string; description: string }) => api.patch<TaskType>(`/hr/task-types/${id}/`, data).then((r) => r.data),
  deleteTaskType: (id: number) => api.delete(`/hr/task-types/${id}/`),

  tasks: share((params: Record<string, string> = {}) => api.get<TaskAssignment[]>('/hr/task-assignments/', { params }).then((r) => r.data)),
  addTask: (data: Record<string, unknown>) => api.post<TaskAssignment>('/hr/task-assignments/', data).then((r) => r.data),
  updateTask: (id: number, data: Record<string, unknown>) => api.patch<TaskAssignment>(`/hr/task-assignments/${id}/`, data).then((r) => r.data),
  setTaskStatus: (id: number, action: TaskStatusAction) => api.post<TaskAssignment>(`/hr/task-assignments/${id}/${action}/`).then((r) => r.data),
  deleteTask: (id: number) => api.delete(`/hr/task-assignments/${id}/`),
}

/** Loads data from the API and reloads it when `deps` change or `reload()` is called. */
export function useApi<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)

  useEffect(() => {
    let live = true
    setLoading(true)
    run()
      .then((d) => live && (setData(d), setError('')))
      .catch((e) => live && setError(parseApiError(e).message))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [run, tick])

  return { data, error, loading, reload: () => setTick((n) => n + 1), setData }
}

const money = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 })
export const formatMoney = (v: string | number) => money.format(Number(v))
export const formatDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00` : iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
export const formatTime = (t: string | null) => (t ? t.slice(0, 5) : '—')
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const thisMonth = () => todayISO().slice(0, 7)

export const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  active: 'green', present: 'green', approved: 'green', paid: 'green', done: 'green',
  pending: 'amber', late: 'amber', draft: 'amber',
  suspended: 'red', absent: 'red', rejected: 'red',
  off: 'slate', cancelled: 'slate',
  in_progress: 'blue',
}

export const HR_PAGE_SLUGS = ['', 'employee-records', 'activations', 'role-assignment', 'branch-allocation', 'attendance', 'leave', 'payroll']
