import { AnimatePresence } from 'framer-motion'
import { CheckCircle2, Hourglass, Plus, Search, ShoppingCart, Trash2, Truck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, Input, Loading, Panel, Pill, Select, Stat } from '../../components/hr/ui'
import { parseApiError, type FieldErrors } from '../../lib/api'
import { bnb, PAY_STATUSES, type PayStatus, type StockPurchase } from '../../lib/bnb'
import { formatDate, formatMoney, useApi } from '../../lib/hr'
import { Dialog, DialogFooter, TillGateDialog } from './Dialog'
import { SupplierFields } from './SupplierFields'
import type { AccountPageProps } from './types'

interface FormState {
  supplier_name: string
  supplier_phone: string
  item: string
  quantity: string
  unit_price: string
  payment_status: PayStatus
}

const EMPTY_FORM: FormState = { supplier_name: '', supplier_phone: '', item: '', quantity: '1', unit_price: '', payment_status: 'paid' }

export default function StockPurchases({ t, me }: AccountPageProps) {
  const { data, error, loading, reload, setData } = useApi(bnb.purchases)
  const suppliers = useApi(bnb.suppliers)
  const tills = useApi(() => bnb.tills({ open: '1' }))
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const [busyId, setBusyId] = useState(0)
  const [q, setQ] = useState('')
  /** The buy-stock popup sits behind `?register` — the sidebar link (and the
   *  button on this page) both set it; removing it closes the popup. */
  const [params, setParams] = useSearchParams()
  const close = () => setParams({})

  const rows = data ?? []
  /** Records are tied to a till session — the popup only opens on a till this
   *  user holds (receptionists are locked to the session they opened). */
  const open = (tills.data ?? []).find((s) => s.status === 'open')
  const mine = !!open && (me.role !== 'branch_receptionist' || open.opened_by === me.id)
  const totals = {
    paid: rows.filter((p) => p.payment_status === 'paid').reduce((s, p) => s + Number(p.total), 0),
    pending: rows.filter((p) => p.payment_status === 'pending').reduce((s, p) => s + Number(p.total), 0),
  }
  const list = rows.filter((p) => !q || `${p.item} ${p.supplier_name} ${p.supplier_phone}`.toLowerCase().includes(q.toLowerCase()))

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setFlash({ text: '', bad: false })
    try {
      const purchase = await bnb.registerPurchase({
        supplier_name: form.supplier_name.trim(),
        supplier_phone: form.supplier_phone.trim(),
        item: form.item.trim(),
        quantity: Math.max(1, Number(form.quantity) || 1),
        unit_price: Number(form.unit_price),
        payment_status: form.payment_status,
      })
      setData((l) => [purchase, ...(l ?? [])])
      setForm(EMPTY_FORM)
      setParams({})
      setFlash({ text: `Stock purchase “${purchase.item}” recorded — ${formatMoney(purchase.total)}.`, bad: false })
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.fields)
      setFlash({ text: parsed.message, bad: true })
    } finally {
      setBusy(false)
    }
  }

  async function togglePaid(row: StockPurchase) {
    setBusyId(row.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await bnb.updatePurchase(row.id, { payment_status: row.payment_status === 'paid' ? 'pending' : 'paid' })
      setData((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? null)
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setBusyId(0)
    }
  }

  async function remove(row: StockPurchase) {
    setBusyId(row.id)
    setFlash({ text: '', bad: false })
    try {
      await bnb.deletePurchase(row.id)
      setData((l) => l?.filter((x) => x.id !== row.id) ?? null)
      setFlash({ text: `Purchase “${row.item}” deleted.`, bad: false })
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
        <Stat t={t} i={0} icon={CheckCircle2} label="Stock paid for" value={data ? formatMoney(totals.paid) : '—'} />
        <Stat t={t} i={1} icon={Hourglass} label="Pending payment" value={data ? formatMoney(totals.pending) : '—'} />
        <Stat t={t} i={2} icon={Truck} label="Purchases recorded" value={data ? rows.length : '—'} />
      </div>

      <Panel
        t={t}
        title="Stock purchases"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button t={t} onClick={() => setParams({ register: '1' })}>
              <Plus className="size-3.5" /> Buy stock
            </Button>
            <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />
            <div className="relative sm:w-56">
              <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search item or supplier"
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
            icon={ShoppingCart}
            title={rows.length ? 'No purchases match your search' : 'No stock purchases yet'}
            text={rows.length ? 'Try a different search.' : 'Use the Buy stock link above to record your first stock purchase.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="rtable w-full min-w-[48rem] text-left text-xs">
              <thead>
                <tr>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Supplier</th>
                  <th className={thCls}>Item</th>
                  <th className={`${thCls} text-right`}>Qty</th>
                  <th className={`${thCls} text-right`}>Price each</th>
                  <th className={`${thCls} text-right`}>Total</th>
                  <th className={thCls}>Status</th>
                  <th className={`${thCls} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id} className="border-t border-slate-900/5 dark:border-white/5">
                    <td className={`px-3 py-2.5 ${t.muted}`}>{formatDate(row.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <span className="block text-sm font-medium">{row.supplier_name}</span>
                      <span className={t.muted}>{row.supplier_phone || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">{row.item}</td>
                    <td className="px-3 py-2.5 text-right">{row.quantity}</td>
                    <td className="px-3 py-2.5 text-right">{formatMoney(row.unit_price)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatMoney(row.total)}</td>
                    <td className="px-3 py-2.5">
                      <Pill tone={row.payment_status === 'paid' ? 'green' : 'amber'}>{row.payment_status_label}</Pill>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button t={t} variant="ghost" className="h-7 px-2.5 text-[11px]" busy={busyId === row.id} onClick={() => togglePaid(row)}>
                          {row.payment_status === 'paid' ? 'Mark pending' : 'Mark paid'}
                        </Button>
                        <Button t={t} variant="danger" className="h-7 px-2.5 text-[11px]" busy={busyId === row.id} onClick={() => remove(row)} aria-label={`Delete ${row.item}`}>
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
          <Dialog t={t} title="Buy stock" text="Record stock bought from a supplier — it lands in the purchases below." icon={ShoppingCart}
            onClose={close} onSubmit={submit}
            footer={<DialogFooter t={t} message={flash.bad ? flash.text : ''} onClose={close} busy={busy} submitLabel="Record purchase" />}>
            <div className="flex flex-col gap-3 overflow-y-auto px-5 py-5">
              <SupplierFields t={t} suppliers={suppliers.data ?? []}
                name={form.supplier_name} phone={form.supplier_phone}
                onName={(v) => set('supplier_name', v)} onPhone={(v) => set('supplier_phone', v)}
                nameError={errors.supplier_name} phoneError={errors.supplier_phone} />
              <Input t={t} label="Supplied item" value={form.item} onChange={(e) => set('item', e.target.value)} placeholder="e.g. Bath towels" required error={errors.item} />
              <Input t={t} label="Quantity" type="number" min="1" step="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required error={errors.quantity} />
              <Input t={t} label="Buying price of each item" type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} placeholder="0.00" required error={errors.unit_price} />
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
