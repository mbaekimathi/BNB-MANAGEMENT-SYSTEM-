import { AnimatePresence } from 'framer-motion'
import { Banknote, CheckCircle2, Trash2, Wallet } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Empty, ErrorNote, Flash, Input, Loading, Panel, Person, Pill, Row, Select, Stat } from '../../components/hr/ui'
import { parseApiError, type FieldErrors } from '../../lib/api'
import { formatMoney, hr, thisMonth, useApi, STATUS_TONE } from '../../lib/hr'
import type { HrPageProps } from './types'

const blank = { employee_id: '', basic_salary: '', allowances: '', deductions: '' }
const num = (v: string) => Number(v) || 0

export default function Payroll({ t }: HrPageProps) {
  const [month, setMonth] = useState(thisMonth())
  const people = useApi(hr.employeeChoices)
  const { data, error, loading, reload, setData } = useApi(() => hr.payroll(month), [month])
  const [form, setForm] = useState(blank)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [flash, setFlash] = useState({ text: '', bad: false })
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const listed = new Set(data?.map((r) => r.employee.id))
  const sum = (pick: (r: NonNullable<typeof data>[number]) => string) => (data ?? []).reduce((a, r) => a + Number(pick(r)), 0)
  const net = num(form.basic_salary) + num(form.allowances) - num(form.deductions)
  const label = new Date(`${month}-01T00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const rec = await hr.addPayroll({
        employee_id: Number(form.employee_id) || null,
        period: `${month}-01`,
        basic_salary: form.basic_salary || '0',
        allowances: form.allowances || '0',
        deductions: form.deductions || '0',
      })
      setData((l) => [...(l ?? []), rec])
      setForm(blank)
      setFlash({ text: `Payslip added for ${rec.employee.full_name}: ${formatMoney(rec.net_pay)}.`, bad: false })
    } catch (err) {
      const { message, fields } = parseApiError(err)
      setErrors(fields)
      setFlash({ text: message, bad: true })
    } finally {
      setSaving(false)
    }
  }

  async function act(id: number, kind: 'pay' | 'delete') {
    setBusy(id)
    try {
      if (kind === 'pay') {
        const rec = await hr.payPayroll(id)
        setData((l) => l?.map((x) => (x.id === id ? rec : x)) ?? null)
      } else {
        await hr.deletePayroll(id)
        setData((l) => l?.filter((x) => x.id !== id) ?? null)
      }
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat t={t} i={0} icon={Wallet} label={`Net pay · ${label}`} value={formatMoney(sum((r) => r.net_pay))} hint={`${data?.length ?? 0} payslips`} />
        <Stat t={t} i={1} icon={CheckCircle2} label="Paid" value={formatMoney((data ?? []).filter((r) => r.status === 'paid').reduce((a, r) => a + Number(r.net_pay), 0))} hint={`${data?.filter((r) => r.status === 'paid').length ?? 0} paid`} />
        <Stat t={t} i={2} icon={Banknote} label="Still to pay" value={formatMoney((data ?? []).filter((r) => r.status === 'draft').reduce((a, r) => a + Number(r.net_pay), 0))} hint={`${data?.filter((r) => r.status === 'draft').length ?? 0} drafts`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel t={t} title="Payslips" actions={<div className="w-44"><Input t={t} type="month" aria-label="Month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></div>}>
          {error ? (
            <ErrorNote t={t} message={error} onRetry={reload} />
          ) : loading && !data ? (
            <Loading t={t} />
          ) : !data?.length ? (
            <Empty t={t} icon={Banknote} title={`No payslips for ${label}`} text="Add each employee's pay with the form." />
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {data.map((r, i) => (
                  <Row key={r.id} t={t} i={i}>
                    <div className="min-w-0 flex-1"><Person t={t} user={r.employee} /></div>
                    <div className={`grid grid-cols-3 gap-2 text-[11px] sm:w-72 ${t.muted}`}>
                      <span>Basic<br /><b className="font-medium">{formatMoney(r.basic_salary)}</b></span>
                      <span>Allowances<br /><b className="font-medium">+{formatMoney(r.allowances)}</b></span>
                      <span>Deductions<br /><b className="font-medium">−{formatMoney(r.deductions)}</b></span>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:w-64 sm:justify-end">
                      <span className={`text-sm font-semibold ${t.accentText}`}>{formatMoney(r.net_pay)}</span>
                      <Pill tone={STATUS_TONE[r.status]}>{r.status_label}</Pill>
                      {r.status === 'draft' && (
                        <>
                          <Button t={t} busy={busy === r.id} onClick={() => act(r.id, 'pay')}>Mark paid</Button>
                          <button type="button" disabled={busy === r.id} onClick={() => act(r.id, 'delete')} aria-label="Delete payslip" className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-rose-500`}>
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </Row>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Panel>

        <Panel t={t} title={`Add payslip · ${label}`} className="h-fit">
          <form onSubmit={submit} className="space-y-3">
            <Select t={t} label="Employee" value={form.employee_id} onChange={set('employee_id')} error={errors.employee_id ?? errors.employee} required>
              <option value="">Choose…</option>
              {(people.data ?? []).filter((p) => !listed.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.code})</option>)}
            </Select>
            <Input t={t} label="Basic salary (KES)" type="number" min="0" step="0.01" value={form.basic_salary} onChange={set('basic_salary')} error={errors.basic_salary} required />
            <div className="grid grid-cols-2 gap-3">
              <Input t={t} label="Allowances" type="number" min="0" step="0.01" value={form.allowances} onChange={set('allowances')} error={errors.allowances} />
              <Input t={t} label="Deductions" type="number" min="0" step="0.01" value={form.deductions} onChange={set('deductions')} error={errors.deductions} />
            </div>
            <p className={`text-xs ${t.muted}`}>Net pay: <span className={`font-semibold ${t.accentText}`}>{formatMoney(net)}</span></p>
            <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />
            <Button t={t} type="submit" busy={saving} className="w-full">Add payslip</Button>
          </form>
        </Panel>
      </div>
    </div>
  )
}
