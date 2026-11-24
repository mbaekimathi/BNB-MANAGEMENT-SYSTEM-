import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Ban, Building2, CircleCheck, Loader2, Mail, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, Loading, Panel, Pill, Row, Stat } from '../../components/hr/ui'
import { formatDate, useApi } from '../../lib/hr'
import { parseApiError } from '../../lib/api'
import { bnb, type Branch } from '../../lib/bnb'
import { RegisterBranch } from './RegisterBranch'
import type { BnbPageProps } from './types'
import type { WorkspaceTheme } from '../../lib/workspaces'

export default function BnbOverview({ t, base }: BnbPageProps) {
  const { data, error, loading, reload, setData } = useApi(bnb.branches)
  const [registering, setRegistering] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [deleting, setDeleting] = useState<Branch | null>(null)
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState('')

  async function toggleStatus(b: Branch) {
    setBusy(b.id)
    setFlash('')
    try {
      const updated = await bnb.updateBranch(b.id, { status: b.status === 'suspended' ? 'active' : 'suspended' })
      setData((l) => l?.map((x) => (x.id === b.id ? updated : x)) ?? null)
    } catch (err) {
      setFlash(parseApiError(err).message)
    } finally {
      setBusy(0)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat t={t} i={0} icon={Building2} label="Registered branches" value={data?.length ?? '—'} />
        <Stat
          t={t} i={1} icon={MapPin} label="Latest branch"
          value={<span className="block truncate text-lg leading-8">{data?.[0]?.name ?? '—'}</span>}
          hint={data?.[0] ? `Added ${formatDate(data[0].created_at)}` : undefined}
        />
      </div>

      <Panel
        t={t}
        title="Registered BnB branches"
        actions={
          <div className="flex items-center gap-3">
            <Link to={`${base}/branch-approvals`} className={`inline-flex items-center gap-1 text-xs ${t.accentText}`}>
              Pending approvals <ArrowUpRight className="size-3.5" />
            </Link>
            <Button t={t} onClick={() => { setEditing(null); setRegistering(true) }}>
              <Plus className="size-3.5" /> Register branch
            </Button>
          </div>
        }
      >
        <div className="mb-3"><Flash message={flash} tone="red" /></div>
        {error ? (
          <ErrorNote t={t} message={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading t={t} />
        ) : !data?.length ? (
          <Empty t={t} icon={Building2} title="No branches registered yet" text="Use the Register branch button to add your first BnB branch." />
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {data.map((b, i) => (
                <Row key={b.id} t={t} i={i}>
                  <div className={`flex min-w-0 flex-1 items-center gap-3 ${b.status === 'suspended' ? 'opacity-55' : ''}`}>
                    <span className={`relative grid size-11 shrink-0 place-items-center overflow-hidden ${t.radius} ${t.iconBox}`}>
                      {b.photo ? <img src={b.photo} alt="" className="size-full object-cover" /> : <Building2 className="size-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{b.name}</p>
                      <p className={`truncate text-xs ${t.muted}`}>
                        <MapPin className="mr-1 inline size-3" />{b.location}
                      </p>
                    </div>
                  </div>
                  <div className={`min-w-0 text-xs sm:w-48 ${t.muted}`}>
                    <p className="truncate"><Mail className="mr-1 inline size-3" />{b.email}</p>
                    <p className="truncate"><Phone className="mr-1 inline size-3" />{b.phone}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    {b.status === 'suspended' ? <Pill tone="red">Suspended</Pill> : <Pill tone="blue">Code {b.code}</Pill>}
                    <span className={`text-[11px] ${t.muted}`}>{formatDate(b.created_at)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button" aria-label={`Edit ${b.name}`} title="Edit"
                        onClick={() => { setEditing(b); setRegistering(true) }}
                        className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-sky-500`}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button" aria-label={`${b.status === 'suspended' ? 'Reactivate' : 'Suspend'} ${b.name}`}
                        title={b.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                        disabled={busy === b.id} onClick={() => void toggleStatus(b)}
                        className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-amber-500 disabled:opacity-40`}
                      >
                        {busy === b.id ? <Loader2 className="size-4 animate-spin" /> : b.status === 'suspended' ? <CircleCheck className="size-4" /> : <Ban className="size-4" />}
                      </button>
                      <button
                        type="button" aria-label={`Delete ${b.name}`} title="Delete"
                        onClick={() => setDeleting(b)}
                        className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-rose-500`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </Row>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Panel>

      <RegisterBranch
        t={t}
        open={registering}
        editing={editing}
        onClose={() => { setRegistering(false); setEditing(null) }}
        onSaved={(b) => {
          setData((l) => (editing ? (l?.map((x) => (x.id === b.id ? b : x)) ?? null) : [b, ...(l ?? [])]))
          setRegistering(false)
          setEditing(null)
        }}
      />
      <ConfirmDelete t={t} branch={deleting} onClose={() => setDeleting(null)} onDeleted={(id) => setData((l) => l?.filter((x) => x.id !== id) ?? null)} />
    </div>
  )
}

function ConfirmDelete({ t, branch, onClose, onDeleted }: { t: WorkspaceTheme; branch: Branch | null; onClose: () => void; onDeleted: (id: number) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function remove() {
    if (!branch) return
    setBusy(true)
    setErr('')
    try {
      await bnb.deleteBranch(branch.id)
      onDeleted(branch.id)
      onClose()
    } catch (e) {
      setErr(parseApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {branch && (
        <motion.div
          key={branch.id}
          className="fixed inset-0 z-[60] grid place-items-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <motion.div
            role="alertdialog" aria-modal="true" aria-label={`Delete ${branch.name}`}
            initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className={`relative w-full max-w-sm p-5 shadow-2xl ${t.radius} ${t.root}`}
          >
            <span className={`grid size-10 place-items-center ${t.radius} bg-rose-500/10 text-rose-500`}>
              <Trash2 className="size-5" />
            </span>
            <h3 className={`mt-3 text-base ${t.heading}`}>Delete {branch.name}?</h3>
            <p className={`mt-1 text-xs ${t.muted}`}>
              This permanently removes the branch, its sign-in code {branch.code} and its photo. Staff assigned to it will keep their accounts.
            </p>
            <div className="mt-3"><Flash message={err} tone="red" /></div>
            <div className="mt-4 flex justify-end gap-2">
              <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
              <Button t={t} variant="danger" busy={busy} onClick={() => void remove()}>Delete branch</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
