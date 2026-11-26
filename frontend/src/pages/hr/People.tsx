import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Building2, CircleCheck, Loader2, Mail, Pencil, Phone, Search, ShieldCheck, UserCheck, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, ErrorNote, Flash, Input, Loading, Panel, Person, Pill, Row, Select } from '../../components/hr/ui'
import { parseApiError, type Employee, type Role } from '../../lib/api'
import { bnb } from '../../lib/bnb'
import { formatDate, hr, useApi, STATUS_TONE } from '../../lib/hr'
import { isBranchRole, ROLE_LABELS } from '../../lib/roles'
import { EmployeeEditor } from './EmployeeEditor'
import type { HrPageProps } from './types'

const ROLES = Object.entries(ROLE_LABELS) as [Role, string][]

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** Roles the signed-in person is allowed to give out. */
const assignable = (me: Employee) => ROLES.filter(([r]) => r !== 'admin' || me.role === 'admin')
const canEditDetails = (me: Employee, u: Employee) => u.role !== 'admin' || me.role === 'admin'
const canEdit = (me: Employee, u: Employee) => u.id !== me.id && canEditDetails(me, u)

export function EmployeeRecords({ t, me }: HrPageProps) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const query = useDebounced(q)
  const { data, error, loading, reload, setData } = useApi(
    () => hr.employees({ q: query, status, role, sort: 'name' }),
    [query, status, role],
  )
  const [busy, setBusy] = useState<number | null>(null)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const [editing, setEditing] = useState<Employee | null>(null)

  function saved(next: Employee) {
    setData((list) => list?.map((x) => (x.id === next.id ? next : x)) ?? null)
    setEditing(null)
    setFlash({ text: `${next.full_name}'s details were saved.`, bad: false })
  }

  async function toggle(u: Employee) {
    setBusy(u.id)
    try {
      const next = u.status === 'active' ? await hr.suspend(u.id) : await hr.activate(u.id)
      setData((list) => list?.map((x) => (x.id === u.id ? next : x)) ?? null)
      setFlash({ text: `${next.full_name} is now ${next.status_label.toLowerCase()}.`, bad: false })
    } catch (e) {
      setFlash({ text: parseApiError(e).message, bad: true })
    } finally {
      setBusy(null)
    }
  }

  const th = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`

  return (
    <Panel t={t} title={data ? `${data.length} ${data.length === 1 ? 'employee' : 'employees'}` : 'Employees'}>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_11rem_11rem]">
        <div className="relative">
          <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, code, email or phone"
            className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
          />
        </div>
        <Select t={t} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending activation</option>
          <option value="suspended">Suspended</option>
        </Select>
        <Select t={t} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="">All roles</option>
          {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      <div className="mb-3"><Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} /></div>
      {error ? (
        <ErrorNote t={t} message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading t={t} />
      ) : !data?.length ? (
        <Empty t={t} icon={Users} title="No employees found" text="Try a different search or filter." />
      ) : (
        <div className="overflow-x-auto">
          <table className="rtable w-full min-w-[760px] table-fixed border-collapse">
            <thead>
              <tr className={`border-b ${t.sidebarDivider}`}>
                <th className={th}>Employee</th>
                <th className={`w-52 ${th}`}>Contact</th>
                <th className={`w-44 ${th}`}>Branch</th>
                <th className={`w-24 ${th}`}>Joined</th>
                <th className={`w-24 ${th}`}>Status</th>
                <th className={`w-24 ${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {data.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
                    className={`border-b transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${t.sidebarDivider}`}
                  >
                    <td className="max-w-0 px-3 py-3 align-middle"><Person t={t} user={u} /></td>
                    <td className={`px-3 py-3 align-middle text-xs ${t.muted}`}>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="inline-flex min-w-0 items-center gap-1.5"><Mail className="size-3.5 shrink-0" /><span className="truncate">{u.email}</span></span>
                        <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 shrink-0" />{u.phone}</span>
                      </div>
                    </td>
                    <td className={`px-3 py-3 align-middle text-xs ${t.muted}`}>
                      {u.branch_name ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Building2 className="size-3.5 shrink-0" /><span className="truncate">{u.branch_name}</span>
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 ${isBranchRole(u.role) ? 'text-amber-600 dark:text-amber-300' : ''}`}>
                          <Building2 className="size-3.5 shrink-0" />{isBranchRole(u.role) ? 'Not allocated' : 'Company-wide'}
                        </span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-3 align-middle text-xs ${t.muted}`}>{formatDate(u.created_at)}</td>
                    <td className="px-3 py-3 align-middle"><Pill tone={STATUS_TONE[u.status]}>{u.status_label}</Pill></td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        {canEditDetails(me, u) && (
                          <button
                            type="button" aria-label={`Edit ${u.full_name}`} title="Edit"
                            onClick={() => setEditing(u)}
                            className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-sky-500`}
                          >
                            <Pencil className="size-4" />
                          </button>
                        )}
                        {canEdit(me, u) && (
                          <button
                            type="button"
                            aria-label={`${u.status === 'active' ? 'Suspend' : 'Activate'} ${u.full_name}`}
                            title={u.status === 'active' ? 'Suspend' : 'Activate'}
                            disabled={busy === u.id}
                            onClick={() => toggle(u)}
                            className={`grid size-8 place-items-center ${t.radius} ${t.muted} disabled:opacity-40 ${u.status === 'active' ? 'hover:text-rose-500' : 'hover:text-emerald-500'}`}
                          >
                            {busy === u.id ? <Loader2 className="size-4 animate-spin" /> : u.status === 'active' ? <Ban className="size-4" /> : <CircleCheck className="size-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
      <EmployeeEditor t={t} me={me} employee={editing} onClose={() => setEditing(null)} onSaved={saved} />
    </Panel>
  )
}

export function PendingActivation({ t, me }: HrPageProps) {
  const { data, error, loading, reload, setData } = useApi(() => hr.employees({ status: 'pending' }))
  const branches = useApi(bnb.branches)
  const [roles, setRoles] = useState<Record<number, Role>>({})
  const [branchSel, setBranchSel] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [flash, setFlash] = useState({ text: '', bad: false })

  async function decide(u: Employee, approve: boolean) {
    const role = roles[u.id] ?? u.role
    const branchId = branchSel[u.id] ? Number(branchSel[u.id]) : null
    if (approve && isBranchRole(role) && !branchId) {
      setFlash({ text: `Pick which branch ${u.full_name} will work at.`, bad: true })
      return
    }
    setBusy(u.id)
    try {
      const next = approve ? await hr.activate(u.id, role, branchId) : await hr.suspend(u.id)
      setData((list) => list?.filter((x) => x.id !== u.id) ?? null)
      setFlash({
        text: approve
          ? `${next.full_name} is active as ${next.role_label}${next.branch_name ? ` at ${next.branch_name}` : ''}. They can sign in now.`
          : `${next.full_name}'s sign-up was declined.`,
        bad: false,
      })
    } catch (e) {
      setFlash({ text: parseApiError(e).message, bad: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel t={t} title={data ? `${data.length} waiting for approval` : 'Waiting for approval'}>
      <div className="mb-3"><Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} /></div>
      {error ? (
        <ErrorNote t={t} message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading t={t} />
      ) : !data?.length ? (
        <Empty t={t} icon={UserCheck} title="No one is waiting" text="New sign-ups will appear here until you approve them." />
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {data.map((u, i) => (
              <Row key={u.id} t={t} i={i}>
                <div className="min-w-0 flex-1"><Person t={t} user={u} sub={`${u.code} · signed up ${formatDate(u.created_at)}`} /></div>
                <div className={`flex min-w-0 flex-col gap-0.5 text-xs sm:w-52 ${t.muted}`}>
                  <span className="truncate">{u.email}</span>
                  <span>{u.phone}</span>
                </div>
                <div className="flex flex-col gap-2 sm:w-52">
                  <Select t={t} aria-label="Role to give" value={roles[u.id] ?? u.role} onChange={(e) => setRoles((r) => ({ ...r, [u.id]: e.target.value as Role }))}>
                    {assignable(me).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  {isBranchRole(roles[u.id] ?? u.role) && (
                    <Select
                      t={t}
                      aria-label="Branch to allocate"
                      value={branchSel[u.id] ?? ''}
                      onChange={(e) => setBranchSel((s) => ({ ...s, [u.id]: e.target.value }))}
                    >
                      <option value="">{branches.data?.length ? 'Choose branch…' : 'No branches registered yet'}</option>
                      {(branches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button t={t} busy={busy === u.id} onClick={() => decide(u, true)}>Approve</Button>
                  <Button t={t} variant="danger" disabled={busy === u.id} onClick={() => decide(u, false)}>Decline</Button>
                </div>
              </Row>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Panel>
  )
}

export function RoleAssignment({ t, me }: HrPageProps) {
  const [filter, setFilter] = useState<Role | ''>('')
  const [q, setQ] = useState('')
  const { data, error, loading, reload, setData } = useApi(() => hr.employees({ sort: 'name' }))
  const [busy, setBusy] = useState<number | null>(null)
  const [flash, setFlash] = useState({ text: '', bad: false })

  const counts = useMemo(() => {
    const c: Partial<Record<Role, number>> = {}
    data?.forEach((u) => (c[u.role] = (c[u.role] ?? 0) + 1))
    return c
  }, [data])
  const list = (data ?? []).filter(
    (u) => (!filter || u.role === filter) && (!q || `${u.full_name} ${u.code}`.toLowerCase().includes(q.toLowerCase())),
  )

  async function change(u: Employee, role: Role) {
    setBusy(u.id)
    try {
      const next = await hr.updateEmployee(u.id, { role })
      setData((l) => l?.map((x) => (x.id === u.id ? next : x)) ?? null)
      setFlash({ text: `${next.full_name} is now ${next.role_label}.`, bad: false })
    } catch (e) {
      setFlash({ text: parseApiError(e).message, bad: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter('')} className={`px-3 py-1.5 text-xs transition ${t.radius} ${filter === '' ? t.navActive : t.chip}`}>
          Everyone · {data?.length ?? 0}
        </button>
        {ROLES.map(([v, l]) => (
          <button key={v} type="button" onClick={() => setFilter(v)} className={`px-3 py-1.5 text-xs transition ${t.radius} ${filter === v ? t.navActive : t.chip}`}>
            {l} · {counts[v] ?? 0}
          </button>
        ))}
      </div>
      <Panel t={t} title="Change a role" actions={<div className="w-full sm:w-64"><Input t={t} placeholder="Find by name or code" value={q} onChange={(e) => setQ(e.target.value)} /></div>}>
        <div className="mb-3"><Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} /></div>
        {error ? (
          <ErrorNote t={t} message={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading t={t} />
        ) : !list.length ? (
          <Empty t={t} icon={ShieldCheck} title="No one has this role yet" />
        ) : (
          <ul className="space-y-2">
            {list.map((u, i) => (
              <Row key={u.id} t={t} i={i}>
                <div className="min-w-0 flex-1"><Person t={t} user={u} sub={u.code} /></div>
                <Pill tone={STATUS_TONE[u.status]}>{u.status_label}</Pill>
                <div className="sm:w-60">
                  {canEdit(me, u) ? (
                    <Select t={t} aria-label={`Role for ${u.full_name}`} value={u.role} disabled={busy === u.id} onChange={(e) => change(u, e.target.value as Role)}>
                      {assignable(me).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  ) : (
                    <p className={`text-xs ${t.muted}`}>{u.role_label} · {u.id === me.id ? "that's you" : 'Admin only'}</p>
                  )}
                </div>
              </Row>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
