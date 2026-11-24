import { AnimatePresence } from 'framer-motion'
import { Building2, UserX, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Empty, ErrorNote, Flash, Loading, Panel, Person, Pill, Row, Select, Stat } from '../../components/hr/ui'
import { parseApiError, type Employee } from '../../lib/api'
import { bnb } from '../../lib/bnb'
import { hr, useApi, STATUS_TONE } from '../../lib/hr'
import { isBranchRole } from '../../lib/roles'
import type { HrPageProps } from './types'

export default function BranchAllocation({ t }: HrPageProps) {
  const branches = useApi(bnb.branches)
  const { data, error, loading, reload, setData } = useApi(() => hr.employees({ sort: 'name' }))
  const [busy, setBusy] = useState<number | null>(null)
  const [flash, setFlash] = useState({ text: '', bad: false })

  const staff = useMemo(() => (data ?? []).filter((u) => isBranchRole(u.role)), [data])
  const unallocated = staff.filter((u) => !u.branch)
  const members = (branchId: number) => staff.filter((u) => u.branch === branchId)

  async function assign(u: Employee, branchId: number | null) {
    setBusy(u.id)
    try {
      const next = await hr.updateEmployee(u.id, { branch: branchId })
      setData((l) => l?.map((x) => (x.id === u.id ? next : x)) ?? null)
      setFlash({
        text: branchId ? `${next.full_name} now works at ${next.branch_name}.` : `${next.full_name} was removed from their branch.`,
        bad: false,
      })
    } catch (e) {
      setFlash({ text: parseApiError(e).message, bad: true })
    } finally {
      setBusy(null)
    }
  }

  const branchPicker = (u: Employee) => (
    <Select
      t={t}
      aria-label={`Branch for ${u.full_name}`}
      value={u.branch ?? ''}
      disabled={busy === u.id}
      onChange={(e) => assign(u, e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">No branch</option>
      {(branches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </Select>
  )

  const staffRow = (u: Employee, i: number) => (
    <Row key={u.id} t={t} i={i}>
      <div className="min-w-0 flex-1"><Person t={t} user={u} sub={u.role_label} /></div>
      <Pill tone={STATUS_TONE[u.status]}>{u.status_label}</Pill>
      <div className="sm:w-52">{branchPicker(u)}</div>
    </Row>
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat t={t} i={0} icon={Building2} label="Registered branches" value={branches.data?.length ?? '—'} />
        <Stat t={t} i={1} icon={Users} label="Staff in branches" value={staff.length - unallocated.length} />
        <Stat t={t} i={2} icon={UserX} label="Waiting for a branch" value={unallocated.length} hint="Branch staff not allocated yet" />
      </div>

      <div className="mb-1"><Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} /></div>

      {error || branches.error ? (
        <ErrorNote t={t} message={error || branches.error} onRetry={() => { reload(); branches.reload() }} />
      ) : (loading && !data) || (branches.loading && !branches.data) ? (
        <Loading t={t} />
      ) : !branches.data?.length ? (
        <Panel t={t}>
          <Empty t={t} icon={Building2} title="No branches registered yet" text="Register a branch under BnB management, then allocate staff here." />
        </Panel>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {branches.data.map((b) => {
            const list = members(b.id)
            return (
              <Panel
                key={b.id}
                t={t}
                title={b.name}
                actions={<Pill tone="blue">Code {b.code} · {list.length} {list.length === 1 ? 'person' : 'people'}</Pill>}
              >
                {!list.length ? (
                  <Empty t={t} icon={Users} title="Nobody works here yet" text="Pick this branch on a person's row to move them in." />
                ) : (
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>{list.map(staffRow)}</AnimatePresence>
                  </ul>
                )}
              </Panel>
            )
          })}

          <Panel t={t} title="Not allocated" actions={<Pill tone="amber">{unallocated.length}</Pill>}>
            {!unallocated.length ? (
              <Empty t={t} icon={Users} title="Everyone has a branch" />
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>{unallocated.map(staffRow)}</AnimatePresence>
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
