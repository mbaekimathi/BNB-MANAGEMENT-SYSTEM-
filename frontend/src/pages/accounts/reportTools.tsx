import { AlertTriangle, Download, FileDown, Printer, type LucideIcon } from 'lucide-react'
import { Component, useMemo, useState, type ReactNode } from 'react'
import { Button, Panel } from '../../components/hr/ui'
import type { Employee } from '../../lib/api'
import { todayISO } from '../../lib/hr'
import type { WorkspaceTheme } from '../../lib/workspaces'
import type { Tone } from '../../components/hr/ui'
import { downloadReportPdf, printReport } from './reportDoc'

export type Hue = 'amber' | 'emerald' | 'green' | 'sky' | 'violet' | 'rose' | 'fuchsia' | 'teal' | 'indigo' | 'slate'

/** Text colour per hue — used for channel amounts and icons. */
export const TXT: Record<Hue, string> = {
  amber: 'text-amber-700 dark:text-amber-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  green: 'text-green-700 dark:text-green-300',
  sky: 'text-sky-700 dark:text-sky-300',
  violet: 'text-violet-700 dark:text-violet-300',
  rose: 'text-rose-700 dark:text-rose-300',
  fuchsia: 'text-fuchsia-700 dark:text-fuchsia-300',
  teal: 'text-teal-700 dark:text-teal-300',
  indigo: 'text-indigo-700 dark:text-indigo-300',
  slate: 'text-slate-600 dark:text-slate-300',
}
/** Coloured band behind a block label or sheet header. */
export const BAND: Record<Hue, string> = {
  amber: 'bg-amber-500/10',
  emerald: 'bg-emerald-500/10',
  green: 'bg-green-500/10',
  sky: 'bg-sky-500/10',
  violet: 'bg-violet-500/10',
  rose: 'bg-rose-500/10',
  fuchsia: 'bg-fuchsia-500/10',
  teal: 'bg-teal-500/10',
  indigo: 'bg-indigo-500/10',
  slate: 'bg-slate-500/10',
}
/** Soft tinted circle for initials and small icons. */
export const SOFT: Record<Hue, string> = {
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  green: 'bg-green-500/15 text-green-700 dark:text-green-300',
  sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  fuchsia: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
  teal: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  indigo: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  slate: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
}

/** Channel → colour: cash = amber, M-Pesa = green, Visa = sky, other = violet. */
export const CH_HUE = { cash: 'amber', mpesa: 'green', visa: 'sky', other: 'violet' } as const
export const GUEST_HUES: Hue[] = ['emerald', 'sky', 'violet', 'fuchsia', 'teal', 'rose']
export const STAY_TONE: Record<string, Tone> = { reserved: 'amber', occupied: 'green', completed: 'blue', cancelled: 'slate' }
export const MATURITY_TONE: Record<string, Tone> = { partial: 'amber', matured: 'blue', void: 'red' }

export const GRID = 'border-slate-900/10 dark:border-white/10'
export const TH = `border-b border-r ${GRID} px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider last:border-r-0`
export const TD = `border-b border-r ${GRID} px-2 py-2 last:border-r-0`

export const fmtDT = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const fmtD = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
export const sum = (ns: number[]) => ns.reduce((s, n) => s + n, 0)
export const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
export const initials = (name: string | null | undefined) =>
  (name ?? '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')

/** Coloured amount for a ledger cell — muted dash when zero. */
export function money(v: number, hue: Hue) {
  return v
    ? <span className={`font-semibold ${TXT[hue]}`}>{fmt(v)}</span>
    : <span className="text-slate-300 dark:text-slate-600">—</span>
}
const moneyFmt = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 })
const fmt = (v: string | number) => moneyFmt.format(Number(v))

/** The shared from/to state every report uses. */
export function useRange() {
  const [fromD, setFromD] = useState(() => `${todayISO().slice(0, 7)}-01`)
  const [toD, setToD] = useState(todayISO)
  const from = useMemo(() => new Date(`${fromD}T00:00:00`), [fromD])
  const to = useMemo(() => new Date(`${toD}T23:59:59.999`), [toD])
  const inRange = (iso: string) => {
    const d = new Date(iso)
    return d >= from && d <= to
  }
  const overlaps = (start: string, end: string) => new Date(start) < to && new Date(end) > from
  return { fromD, toD, setFromD, setToD, from, to, inRange, overlaps }
}

/** Period picker + Print/PDF/CSV actions — the top panel on every report. */
export function RangePanel({ t, fromD, toD, setFromD, setToD, onCsv, ready, title, me }: {
  t: WorkspaceTheme
  fromD: string
  toD: string
  setFromD: (d: string) => void
  setToD: (d: string) => void
  onCsv?: () => void
  ready: boolean
  /** Document title used on the printed letterhead and the PDF header. */
  title: string
  me?: Employee
}) {
  const [pdfBusy, setPdfBusy] = useState(false)
  const doc = { title, fromD, toD, me }
  const pdf = () => {
    setPdfBusy(true)
    downloadReportPdf(doc)
      .catch(() => window.alert('Could not generate the PDF. Please try again.'))
      .finally(() => setPdfBusy(false))
  }
  return (
    <div data-report-toolbar>
    <Panel t={t} title="Report period" actions={
      <div className="flex flex-wrap gap-2">
        <Button t={t} variant="ghost" onClick={() => void printReport(doc)} disabled={!ready}>
          <Printer className="size-3.5" /> Print
        </Button>
        <Button t={t} variant="ghost" onClick={pdf} busy={pdfBusy} disabled={!ready || pdfBusy}>
          <FileDown className="size-3.5" /> Download PDF
        </Button>
        {onCsv && (
          <Button t={t} variant="primary" onClick={onCsv} disabled={!ready}>
            <Download className="size-3.5" /> Download CSV
          </Button>
        )}
      </div>
    }>
      <div className="grid gap-3 sm:max-w-md sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={`text-[11px] font-medium ${t.muted}`}>From</span>
          <input
            type="date" value={fromD} max={toD} onChange={(e) => setFromD(e.target.value || fromD)}
            className={`h-10 w-full bg-transparent px-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring} [color-scheme:light] dark:[color-scheme:dark]`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={`text-[11px] font-medium ${t.muted}`}>To</span>
          <input
            type="date" value={toD} min={fromD} max={todayISO()} onChange={(e) => setToD(e.target.value || toD)}
            className={`h-10 w-full bg-transparent px-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring} [color-scheme:light] dark:[color-scheme:dark]`}
          />
        </label>
      </div>
    </Panel>
    </div>
  )
}

/** Dark banner at the top of a report sheet — title, subtitle, optional right block. */
export function SheetHead({ icon: Icon, title, sub, right }: { icon: LucideIcon; title: ReactNode; sub: ReactNode; right?: ReactNode }) {
  return (
    <div data-sheet-head className="flex flex-wrap items-center justify-between gap-3 bg-slate-800 px-4 py-3.5 text-white sm:px-5 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-white/10">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider sm:text-base">{title}</h2>
          <p className="text-[11px] text-white/60">{sub}</p>
        </div>
      </div>
      {right}
    </div>
  )
}

/** The card frame a report sheet lives inside. */
export function SheetFrame({ t, children, className = '' }: { t: WorkspaceTheme; children: ReactNode; className?: string }) {
  return <section data-report-sheet className={`overflow-hidden ${t.radius} ${t.card} ${className}`}>{children}</section>
}

/** Download an array of CSV lines as a file. */
export function downloadCsv(name: string, lines: string[]) {
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Shows the real error instead of blanking the whole app when a report render throws. */
export class SheetBoundary extends Component<{ t: WorkspaceTheme; children: ReactNode }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <Panel t={this.props.t}>
        <div className="flex items-start gap-3 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-500" />
          <div>
            <p className="font-semibold">The report failed to render</p>
            <p className={`mt-1 font-mono text-xs ${this.props.t.muted}`}>{this.state.error}</p>
          </div>
        </div>
      </Panel>
    )
  }
}
