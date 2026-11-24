import { AnimatePresence } from 'framer-motion'
import { CalendarCheck, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Empty, ErrorNote, Flash, Input, Loading, Panel, Person, Pill, Row, Select, Stat } from '../../components/hr/ui'
import { parseApiError, type FieldErrors } from '../../lib/api'
import { ATTENDANCE_STATUSES, formatTime, hr, todayISO, useApi, STATUS_TONE } from '../../lib/hr'
import type { HrPageProps } from './types'

const blank = { employee_id: '', status: 'present', clock_in: '', clock_out: '', note: '' }

export default function Attendance({ t }: HrPageProps) {
  const [date, setDate] = useState(todayISO())
  const people = useApi(hr.employeeChoices)
  const { data, error, loading, reload, setData } = useApi(() => hr.attendance(date), [date])
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [flash, setFlash] = useState({ text: '', bad: false })
  const [saving, setSaving] = useState(false)

  const recorded = new Set(data?.map((r) => r.employee.id))
  const missing = (people.data ?? []).filter((p) => !recorded.has(p.id))
  const count = (s: string) => data?.filter((r) => r.status === s).length ?? 0
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const working = form.status === 'present' || form.status === 'late'
      const rec = await hr.addAttendance({
        employee_id: Number(form.employee_id) || null,
        date,
        status: form.status,
        clock_in: working && form.clock_in ? form.clock_in : null,
        clock_out: working && form.clock_out ? form.clock_out : null,
        note: form.note,
      })
      setData((l) => [...(l ?? []), rec])
      setForm(blank)
      setFlash({ text: `Saved ${rec.employee.full_name} as ${rec.status_label.toLowerCase()}.`, bad: false })
    } catch (err) {
      const { message, fields } = parseApiError(err)
      setErrors(fields)
      setFlash({ text: message, bad: true })
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    try {
      await hr.deleteAttendance(id)
      setData((l) => l?.filter((r) => r.id !== id) ?? null)
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat t={t} i={0} icon={CalendarCheck} label="Present" value={count('present')} />
        <Stat t={t} i={1} icon={CalendarCheck} label="Late" value={count('late')} />
        <Stat t={t} i={2} icon={CalendarCheck} label="Absent" value={count('absent')} />
        <Stat t={t} i={3} icon={CalendarCheck} label="Not recorded" value={missing.length} hint="Active staff with no entry" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel t={t} title="Attendance register" actions={<div className="w-44"><Input t={t} type="date" aria-label="Day" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>}>
          {error ? (
            <ErrorNote t={t} message={error} onRetry={reload} />
          ) : loading && !data ? (
            <Loading t={t} />
          ) : !data?.length ? (
            <Empty t={t} icon={CalendarCheck} title="Nothing recorded for this day" text="Use the form to record who came in." />
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {data.map((r, i) => (
                  <Row key={r.id} t={t} i={i}>
                    <div className="min-w-0 flex-1"><Person t={t} user={r.employee} /></div>
                    <div className={`text-xs sm:w-32 ${t.muted}`}>{formatTime(r.clock_in)} – {formatTime(r.clock_out)}</div>
                    {r.note && <div className={`truncate text-xs sm:w-40 ${t.muted}`}>{r.note}</div>}
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <Pill tone={STATUS_TONE[r.status]}>{r.status_label}</Pill>
                      <button type="button" onClick={() => remove(r.id)} aria-label="Delete entry" className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-rose-500`}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </Row>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Panel>

        <Panel t={t} title="Record attendance" className="h-fit">
          <form onSubmit={submit} className="space-y-3">
            <Select t={t} label="Employee" value={form.employee_id} onChange={set('employee_id')} error={errors.employee_id ?? errors.employee} required>
              <option value="">Choose…</option>
              {missing.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.code})</option>)}
            </Select>
            <Select t={t} label="Status" value={form.status} onChange={set('status')}>
              {ATTENDANCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            {(form.status === 'present' || form.status === 'late') && (
              <div className="grid grid-cols-2 gap-3">
                <Input t={t} label="Clock in" type="time" value={form.clock_in} onChange={set('clock_in')} error={errors.clock_in} />
                <Input t={t} label="Clock out" type="time" value={form.clock_out} onChange={set('clock_out')} error={errors.clock_out} />
              </div>
            )}
            <Input t={t} label="Note (optional)" value={form.note} onChange={set('note')} maxLength={255} />
            <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />
            <Button t={t} type="submit" busy={saving} className="w-full">Save</Button>
          </form>
        </Panel>
      </div>
    </div>
  )
}
