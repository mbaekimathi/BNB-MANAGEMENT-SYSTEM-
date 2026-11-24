import { ArrowUpRight, CalendarCheck, CalendarDays, Banknote, UserCheck, UserPlus, Users, UserX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorNote, Loading, Panel, Person, Pill, Stat } from '../../components/hr/ui'
import { formatDate, formatMoney, hr, useApi, STATUS_TONE } from '../../lib/hr'
import type { HrPageProps } from './types'

export default function HrOverview({ t, base }: HrPageProps) {
  const { data, error, loading, reload } = useApi(hr.summary)
  if (loading && !data) return <Loading t={t} rows={6} />
  if (error || !data) return <ErrorNote t={t} message={error} onRetry={reload} />
  const a = data.attendance_today
  const maxRole = Math.max(1, ...data.roles.map((r) => r.count))
  const month = new Date(`${data.payroll_month.period}T00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat t={t} i={0} icon={Users} label="All employees" value={data.total} hint={`${data.joined_last_30_days} joined in the last 30 days`} />
        <Stat t={t} i={1} icon={UserCheck} label="Active" value={data.status.active} />
        <Stat t={t} i={2} icon={UserPlus} label="Pending activation" value={data.status.pending} />
        <Stat t={t} i={3} icon={UserX} label="Suspended" value={data.status.suspended} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat t={t} i={4} icon={CalendarCheck} label="Clocked in today" value={a.present + a.late} hint={`${a.late} late · ${a.absent} absent`} />
        <Stat t={t} i={5} icon={CalendarDays} label="On leave today" value={data.on_leave_today} hint={`${data.leave_pending} requests waiting`} />
        <Stat t={t} i={6} icon={Banknote} label={`Payroll · ${month}`} value={formatMoney(data.payroll_month.net_total)} hint={`${data.payroll_month.paid} of ${data.payroll_month.entries} payslips paid`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel t={t} title="Staff by role">
          <ul className="space-y-2.5">
            {data.roles.map((r) => (
              <li key={r.value} className="text-xs">
                <div className="mb-1 flex justify-between">
                  <span>{r.label}</span>
                  <span className={t.muted}>{r.count}</span>
                </div>
                <div className={`h-1.5 overflow-hidden rounded-full ${t.chip}`}>
                  <div className={`h-full rounded-full ${t.brandMark}`} style={{ width: `${(r.count / maxRole) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          t={t}
          title="Newest sign-ups"
          actions={
            <Link to={`${base}/employee-records`} className={`inline-flex items-center gap-1 text-xs ${t.accentText}`}>
              All records <ArrowUpRight className="size-3.5" />
            </Link>
          }
        >
          <ul className="space-y-2">
            {data.recent.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3">
                <Person t={t} user={u} sub={`${u.code} · joined ${formatDate(u.created_at)}`} />
                <Pill tone={STATUS_TONE[u.status]}>{u.status_label}</Pill>
              </li>
            ))}
          </ul>
          {data.status.pending > 0 && (
            <Link to={`${base}/activations`} className={`mt-4 inline-flex items-center gap-1 text-xs ${t.accentText}`}>
              Review {data.status.pending} pending {data.status.pending === 1 ? 'account' : 'accounts'} <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </Panel>
      </div>
    </div>
  )
}
