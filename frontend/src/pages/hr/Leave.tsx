import { AnimatePresence } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Empty, ErrorNote, Flash, Input, Loading, Panel, Person, Pill, Row, Select } from '../../components/hr/ui'
import { parseApiError, type FieldErrors } from '../../lib/api'
import { LEAVE_TYPES, formatDate, hr, todayISO, useApi, type LeaveStatus, STATUS_TONE } from '../../lib/hr'
import type { HrPageProps } from './types'

const TABS: { value: LeaveStatus | ''; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]
const blank = { employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' }

export default function Leave({ t }: HrPageProps) {
  const [tab, setTab] = useState<LeaveStatus | ''>('pending')
  const people = useApi(hr.employeeChoices)
  const { data, error, loading, reload, setData } = useApi(() => hr.leave(tab || undefined), [tab])
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [flash, setFlash] = useState({ text: '', bad: false })
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const rec = await hr.addLeave({ ...form, employee_id: Number(form.employee_id) || null })
      if (tab === 'pending' || tab === '') setData((l) => [rec, ...(l ?? [])])
      setForm(blank)
      setFlash({ text: `Leave request added for ${rec.employee.full_name} (${rec.days} days).`, bad: false })
    } catch (err) {
      const { message, fields } = parseApiError(err)
      setErrors(fields)
      setFlash({ text: message, bad: true })
    } finally {
      setSaving(false)
    }
  }

  async function decide(id: number, decision: 'approve' | 'reject') {
    setBusy(id)
    try {
      const rec = await hr.decideLeave(id, decision)
      setData((l) => (tab === '' ? l?.map((x) => (x.id === id ? rec : x)) : l?.filter((x) => x.id !== id)) ?? null)
      setFlash({ text: `${rec.employee.full_name}'s leave was ${rec.status_label.toLowerCase()}.`, bad: false })
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Panel
        t={t}
        title="Leave requests"
        actions={
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((x) => (
              <button key={x.label} type="button" onClick={() => setTab(x.value)} className={`px-3 py-1.5 text-xs transition ${t.radius} ${tab === x.value ? t.navActive : t.chip}`}>
                {x.label}
              </button>
            ))}
          </div>
        }
      >
        {error ? (
          <ErrorNote t={t} message={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading t={t} />
        ) : !data?.length ? (
          <Empty t={t} icon={CalendarDays} title="No leave requests here" text="Requests you add will show up in Waiting until approved." />
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {data.map((r, i) => (
                <Row key={r.id} t={t} i={i}>
                  <div className="min-w-0 flex-1"><Person t={t} user={r.employee} sub={r.type_label} /></div>
                  <div className={`text-xs sm:w-48 ${t.muted}`}>
                    <p>{formatDate(r.start_date)} – {formatDate(r.end_date)}</p>
                    <p>{r.days} {r.days === 1 ? 'day' : 'days'}{r.reason ? ` · ${r.reason}` : ''}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    {r.status === 'pending' ? (
                      <>
                        <Button t={t} busy={busy === r.id} onClick={() => decide(r.id, 'approve')}>Approve</Button>
                        <Button t={t} variant="danger" disabled={busy === r.id} onClick={() => decide(r.id, 'reject')}>Reject</Button>
                      </>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <Pill tone={STATUS_TONE[r.status]}>{r.status_label}</Pill>
                        {r.decided_by && <span className={`text-[11px] ${t.muted}`}>by {r.decided_by}</span>}
                      </div>
                    )}
                  </div>
                </Row>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Panel>

      <Panel t={t} title="Add a leave request" className="h-fit">
        <form onSubmit={submit} className="space-y-3">
          <Select t={t} label="Employee" value={form.employee_id} onChange={set('employee_id')} error={errors.employee_id ?? errors.employee} required>
            <option value="">Choose…</option>
            {(people.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.code})</option>)}
          </Select>
          <Select t={t} label="Type of leave" value={form.leave_type} onChange={set('leave_type')}>
            {LEAVE_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input t={t} label="From" type="date" min={todayISO()} value={form.start_date} onChange={set('start_date')} error={errors.start_date} required />
            <Input t={t} label="To" type="date" min={form.start_date || todayISO()} value={form.end_date} onChange={set('end_date')} error={errors.end_date} required />
          </div>
          <Input t={t} label="Reason (optional)" value={form.reason} onChange={set('reason')} maxLength={255} />
          <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />
          <Button t={t} type="submit" busy={saving} className="w-full">Add request</Button>
        </form>
      </Panel>
    </div>
  )
}
