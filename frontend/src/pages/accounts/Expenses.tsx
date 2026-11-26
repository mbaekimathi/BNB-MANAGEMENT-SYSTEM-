import { AnimatePresence } from 'framer-motion'
import { Banknote, CheckCircle2, Hourglass, Plus, Search, Trash2, Wallet } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, Input, Loading, Panel, Pill, Select, Stat } from '../../components/hr/ui'
import { parseApiError, type FieldErrors } from '../../lib/api'
import { bnb, EXPENSE_CATEGORIES, PAY_STATUSES, type Expense, type ExpenseCategory, type PayStatus } from '../../lib/bnb'
import { formatDate, formatMoney, useApi } from '../../lib/hr'
import { Dialog, DialogFooter, TillGateDialog } from './Dialog'
import { SupplierFields } from './SupplierFields'
import type { AccountPageProps } from './types'

interface FormState {
  category: ExpenseCategory
  name: string
  amount: string
  supplier_name: string
  supplier_phone: string
  payment_status: PayStatus
}

const EMPTY_FORM: FormState = { category: 'supplies', name: '', amount: '', supplier_name: '', supplier_phone: '', payment_status: 'paid' }

export default function Expenses({ t, me }: AccountPageProps) {
  const { data, error, loading, reload, setData } = useApi(bnb.expenses)
  const suppliers = useApi(bnb.suppliers)
  const tills = useApi(() => bnb.tills({ open: '1' }))
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const [busyId, setBusyId] = useState(0)
  const [q, setQ] = useState('')
  /** The register popup sits behind `?register` — the sidebar link (and the
   *  button on this page) both set it; removing it closes the popup. */
  const [params, setParams] = useSearchParams()
  const close = () => setParams({})

  const rows = data ?? []
  /** Records are tied to a till session — the popup only opens on a till this
   *  user holds (receptionists are locked to the session they opened). */
  const open = (tills.data ?? []).find((s) => s.status === 'open')
  const mine = !!open && (me.role !== 'branch_receptionist' || open.opened_by === me.id)
  const totals = {
    paid: rows.filter((e) => e.payment_status === 'paid').reduce((s, e) => s + Number(e.amount), 0),
    pending: rows.filter((e) => e.payment_status === 'pending').reduce((s, e) => s + Number(e.amount), 0),
  }
  const list = rows.filter((e) => !q || `${e.name} ${e.category_label} ${e.supplier_name}`.toLowerCase().includes(q.toLowerCase()))

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setFlash({ text: '', bad: false })
    try {
      const expense = await bnb.registerExpense({
        category: form.category,
        name: form.name.trim(),
        amount: Number(form.amount),
        supplier_name: form.supplier_name.trim(),
        supplier_phone: form.supplier_phone.trim(),
        payment_status: form.payment_status,
      })
      setData((l) => [expense, ...(l ?? [])])
      setForm(EMPTY_FORM)
      setParams({})
      setFlash({ text: `Expense “${expense.name}” recorded — ${formatMoney(expense.amount)}.`, bad: false })
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.fields)
      setFlash({ text: parsed.message, bad: true })
    } finally {
      setBusy(false)
    }
  }

  async function togglePaid(row: Expense) {
    setBusyId(row.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await bnb.updateExpense(row.id, { payment_status: row.payment_status === 'paid' ? 'pending' : 'paid' })
      setData((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? null)
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setBusyId(0)
    }
  }

  async function remove(row: Expense) {
    setBusyId(row.id)
    setFlash({ text: '', bad: false })
    try {
      await bnb.deleteExpense(row.id)
      setData((l) => l?.filter((x) => x.id !== row.id) ?? null)
      setFlash({ text: `Expense “${row.name}” deleted.`, bad: false })
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setBusyId(0)
    }
  }

  const thCls = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat t={t} i={0} icon={CheckCircle2} label="Expenses paid" value={data ? formatMoney(totals.paid) : '—'} />
        <Stat t={t} i={1} icon={Hourglass} label="Pending payment" value={data ? formatMoney(totals.pending) : '—'} />
        <Stat t={t} i={2} icon={Wallet} label="Expenses recorded" value={data ? rows.length : '—'} />
      </div>

      <Panel
        t={t}
        title="Expense records"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button t={t} onClick={() => setParams({ register: '1' })}>
              <Plus className="size-3.5" /> Register expense
            </Button>
            <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />
            <div className="relative sm:w-56">
              <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search expenses"
                className={`h-9 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
              />
            </div>
          </div>
        }
      >
        {error ? (
          <ErrorNote t={t} message={error} onRetry={reload} />
        ) : loading ? (
          <Loading t={t} />
        ) : !list.length ? (
          <Empty
            t={t}
            icon={Banknote}
            title={rows.length ? 'No expenses match your search' : 'No expenses yet'}
            text={rows.length ? 'Try a different search.' : 'Use the Register expense link above to record your first branch expense.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="rtable w-full min-w-[44rem] text-left text-xs">
              <thead>
                <tr>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Category</th>
                  <th className={thCls}>Expense</th>
                  <th className={thCls}>Supplier</th>
                  <th className={`${thCls} text-right`}>Amount</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id} className="border-t border-slate-900/5 dark:border-white/5">
                    <td className={`px-3 py-2.5 ${t.muted}`}>{formatDate(row.created_at)}</td>
                    <td className="px-3 py-2.5">{row.category_label}</td>
                    <td className="px-3 py-2.5">
                      <span className="block text-sm font-medium">{row.name}</span>
                      <span className={t.muted}>{row.created_by_name ? `by ${row.created_by_name}` : ''}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block">{row.supplier_name}</span>
                      <span className={t.muted}>{row.supplier_phone}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatMoney(row.amount)}</td>
                    <td className="px-3 py-2.5">
                      <Pill tone={row.payment_status === 'paid' ? 'green' : 'amber'}>{row.payment_status_label}</Pill>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button t={t} variant="ghost" className="h-7 px-2.5 text-[11px]" busy={busyId === row.id} onClick={() => togglePaid(row)}>
                          {row.payment_status === 'paid' ? 'Mark pending' : 'Mark paid'}
                        </Button>
                        <Button t={t} variant="danger" className="h-7 px-2.5 text-[11px]" busy={busyId === row.id} onClick={() => remove(row)} aria-label={`Delete ${row.name}`}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AnimatePresence>
        {params.has('register') && (mine ? (
          <Dialog t={t} title="Register an expense" text="Record branch spending — it lands in the expense records below." icon={Banknote}
            onClose={close} onSubmit={submit}
            footer={<DialogFooter t={t} message={flash.bad ? flash.text : ''} onClose={close} busy={busy} submitLabel="Register expense" />}>
            <div className="flex flex-col gap-3 overflow-y-auto px-5 py-5">
              <Select t={t} label="Category" value={form.category} onChange={(e) => set('category', e.target.value as ExpenseCategory)} error={errors.category}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
              <Input t={t} label="Name of expense" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Cleaning supplies" required autoFocus error={errors.name} />
              <Input t={t} label="Amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" required error={errors.amount} />
              <SupplierFields t={t} suppliers={suppliers.data ?? []}
                name={form.supplier_name} phone={form.supplier_phone}
                onName={(v) => set('supplier_name', v)} onPhone={(v) => set('supplier_phone', v)}
                nameError={errors.supplier_name} phoneError={errors.supplier_phone} autoFocus={false} />
              <Select t={t} label="Payment status" value={form.payment_status} onChange={(e) => set('payment_status', e.target.value as PayStatus)} error={errors.payment_status}>
                {PAY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
          </Dialog>
        ) : tills.data ? (
          <TillGateDialog t={t} onClose={close} owner={open && me.role === 'branch_receptionist' ? open.opened_by_name : null} />
        ) : null)}
      </AnimatePresence>
    </>
  )
}
