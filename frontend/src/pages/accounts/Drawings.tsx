import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownToLine, CreditCard, DoorOpen, Lock, Smartphone, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, Loading, Panel, Pill } from '../../components/hr/ui'
import { bnb, DRAWING_LABEL, type DrawingMethod } from '../../lib/bnb'
import { formatMoney, useApi } from '../../lib/hr'
import { DrawingDialog } from './Counter'
import { TillGateDialog } from './Dialog'
import type { AccountPageProps } from './types'

const fmtT = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const METHOD_ICON: Record<DrawingMethod, typeof Wallet> = { cash: Wallet, mpesa: Smartphone, visa: CreditCard }

/** Drawings taken from the open till — the list lives here; the "Register
 *  drawing" link opens the register popup. */
export default function Drawings({ t, me }: AccountPageProps) {
  const { data, error, loading, reload } = useApi(() => bnb.tills())
  /** The popup sits behind `?register` — the sidebar link and the button on
   *  this page both set it; removing it closes the popup. */
  const [params, setParams] = useSearchParams()
  const [flash, setFlash] = useState({ text: '', bad: false })

  const current = (data ?? []).find((s) => s.status === 'open')
  /** Receptionists are locked to their own session — other roles keep write access. */
  const mine = !!current && (me.role !== 'branch_receptionist' || current.opened_by === me.id)
  const drawings = current?.drawings ?? []
  const dialog = mine && params.has('register')

  function saved(message: string) {
    setParams({})
    setFlash({ text: message, bad: false })
    reload()
  }

  return (
    <>
      <Panel t={t} actions={
        mine ? (
          <Button t={t} onClick={() => setParams({ register: '1' })}>
            <ArrowDownToLine className="size-3.5" /> Register drawing
          </Button>
        ) : undefined
      }>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`grid size-11 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
            {current ? <DoorOpen className="size-5" /> : <Lock className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            {current ? (
              <>
                <p className="text-sm font-semibold">Till open — {formatMoney(current.drawings_total)} drawn so far</p>
                <p className={`text-xs ${t.muted}`}>
                  cash {formatMoney(current.drawings_cash)} · M-Pesa {formatMoney(current.drawings_mpesa)} · card {formatMoney(current.drawings_card)}
                  {!mine ? ` — ${current.opened_by_name ?? 'Another receptionist'} is holding it, view only` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Till closed</p>
                <p className={`text-xs ${t.muted}`}>Open the till on the Counter page before registering a drawing.</p>
              </>
            )}
          </div>
          <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />
        </div>
      </Panel>

      {error ? (
        <Panel t={t}><ErrorNote t={t} message={error} onRetry={reload} /></Panel>
      ) : loading ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : !current ? null : (
        <Panel t={t} title="Drawings this session">
          {!drawings.length ? (
            <Empty
              t={t}
              icon={ArrowDownToLine}
              title="No drawings yet"
              text="Money taken out of the till mid-session — change float, payouts, banking — is listed here."
            />
          ) : (
            <ul className="space-y-2">
              {drawings.map((d, i) => {
                const Icon = METHOD_ICON[d.method]
                return (
                  <motion.li
                    key={d.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className={`flex items-center gap-3 p-3 ${t.radius} ${t.card}`}
                  >
                    <span className={`grid size-11 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {formatMoney(d.amount)} <span className={`font-normal ${t.muted}`}>— {d.reason || 'Drawing'}</span>
                      </p>
                      <p className={`truncate text-xs ${t.muted}`}>
                        {fmtT(d.created_at)}{d.given_to ? ` · to ${d.given_to}` : ''}{d.created_by_name ? ` · by ${d.created_by_name}` : ''}
                      </p>
                    </div>
                    <Pill tone={d.method === 'cash' ? 'slate' : 'blue'}>{DRAWING_LABEL[d.method]}</Pill>
                  </motion.li>
                )
              })}
            </ul>
          )}
        </Panel>
      )}

      <AnimatePresence>
        {dialog && current && <DrawingDialog t={t} session={current} onClose={() => setParams({})} onSaved={saved} />}
        {!dialog && data && params.has('register') && <TillGateDialog t={t} onClose={() => setParams({})} owner={current && me.role === 'branch_receptionist' ? current.opened_by_name : null} />}
      </AnimatePresence>
    </>
  )
}
