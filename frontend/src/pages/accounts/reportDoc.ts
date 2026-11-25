import { share, type Employee } from '../../lib/api'
import { bnb } from '../../lib/bnb'
import { formatDate } from '../../lib/hr'

/** Document identity for a printed/PDF report — every report page sets its title. */
export interface ReportDocMeta {
  title: string
  fromD: string
  toD: string
  me?: Employee
}

const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })

const mono = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const stamp = () =>
  new Date().toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

interface Company {
  name: string
  code: string
  contact: string
  photo: string | null
}

/** The caller's live branch profile — shared so print + PDF make one request. */
const fetchMyBranch = share(async () => {
  try {
    return await bnb.myBranch()
  } catch {
    return null
  }
})

/** Company letterhead details — the branch the signed-in user works at, read
 *  live from the branch profile with the session user as fallback. */
async function companyOf(me?: Employee): Promise<Company> {
  const prof = await fetchMyBranch()
  const b = me?.branch_detail
  const contact = [prof?.location || b?.location, prof?.phone || b?.phone, prof?.email || b?.email].filter(Boolean).join(' · ')
  return {
    name: prof?.name || b?.name || me?.branch_name || 'Haven Stays',
    code: prof?.code || b?.code || '',
    contact,
    photo: prof?.photo || b?.photo || null,
  }
}

const reportRoot = () => document.querySelector<HTMLElement>('[data-report-root]')

/** Clone of the live report area with toolbars and form controls stripped. */
function reportClone(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-report-toolbar], button, input, select, textarea').forEach((el) => el.remove())
  return clone
}

/** Print: snapshot the report into a clean document (company letterhead +
 *  report + footer) and print only that — the app chrome is hidden by the
 *  print stylesheet in index.css. Dark mode is lifted so the printout is light. */
export async function printReport(doc: ReportDocMeta) {
  const root = reportRoot()
  if (!root) {
    window.print()
    return
  }
  const c = await companyOf(doc.me)
  const generated = stamp()
  const prepared = doc.me ? `by ${doc.me.full_name} · ${doc.me.role_label}` : ''
  const clone = reportClone(root)

  let host = document.getElementById('report-print')
  if (!host) {
    host = document.createElement('div')
    host.id = 'report-print'
    document.body.appendChild(host)
  }
  host.innerHTML = `
    <header class="rp-head">
      <div class="rp-brand">
        ${c.photo
          ? `<img class="rp-logo" src="${escHtml(c.photo)}" alt="" />`
          : `<span class="rp-logo rp-mono">${escHtml(mono(c.name) || 'HS')}</span>`}
        <div>
          <p class="rp-company">${escHtml(c.name)}</p>
          ${c.contact ? `<p class="rp-contact">${escHtml(c.contact)}</p>` : ''}
        </div>
      </div>
      <div class="rp-meta">
        <p class="rp-title">${escHtml(doc.title)}</p>
        <p class="rp-sub">${escHtml(formatDate(doc.fromD))} — ${escHtml(formatDate(doc.toD))}</p>
        <p class="rp-sub">Generated ${escHtml(generated)}${prepared ? ` · ${escHtml(prepared)}` : ''}</p>
      </div>
    </header>
    <div class="rp-rule"></div>
    <main class="rp-body">${clone.innerHTML}</main>
    <footer class="rp-foot">
      <span>${escHtml(c.name)}${c.code ? ` · Branch ${escHtml(c.code)}` : ''}</span>
      <span>Haven Stays · Generated ${escHtml(generated)}</span>
    </footer>`

  const htmlEl = document.documentElement
  const dark = htmlEl.classList.contains('dark')
  const restore = () => {
    if (dark) htmlEl.classList.add('dark')
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  if (dark) htmlEl.classList.remove('dark')
  window.print()
}

async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const fr = new FileReader()
      fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const imgFormat = (dataUrl: string) =>
  dataUrl.startsWith('data:image/png') ? 'PNG' : dataUrl.startsWith('data:image/webp') ? 'WEBP' : 'JPEG'

type Block = { kind: 'table'; el: HTMLTableElement } | { kind: 'text'; lines: string[] }

/** Ordered content blocks of a node: every table becomes a real PDF table,
 *  leaf blocks (stat cards, summary boxes, empty states) become line lists. */
function blocksOf(el: Element, out: Block[] = []): Block[] {
  for (const child of Array.from(el.children)) {
    if (child.matches('table')) {
      out.push({ kind: 'table', el: child as HTMLTableElement })
      continue
    }
    if (child.matches('[data-report-toolbar], [data-sheet-head]')) continue
    if (child.querySelector('table')) {
      blocksOf(child, out)
      continue
    }
    const lines = ((child as HTMLElement).innerText ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
    if (lines.length) out.push({ kind: 'text', lines })
  }
  return out
}

const NAVY: [number, number, number] = [11, 16, 32]
const GOLD: [number, number, number] = [200, 145, 58]
const INK: [number, number, number] = [30, 41, 59]
const GRAY: [number, number, number] = [100, 116, 139]
const LINE: [number, number, number] = [226, 232, 240]
const HEAD_FILL: [number, number, number] = [241, 245, 249]
const HEAD_TEXT: [number, number, number] = [71, 85, 105]
const ALT_FILL: [number, number, number] = [248, 250, 252]

/** PDF: rebuild the report as a vector document — navy letterhead with the
 *  company details, section bands, striped tables and numbered page footers. */
export async function downloadReportPdf(doc: ReportDocMeta) {
  const root = reportRoot()
  if (!root) return
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const MX = 34
  const TOP = 36
  const BOTTOM = 32
  const c = await companyOf(doc.me)
  const generated = stamp()
  const prepared = doc.me ? `Prepared by ${doc.me.full_name} — ${doc.me.role_label}` : ''
  const period = `${formatDate(doc.fromD)} — ${formatDate(doc.toD)}`
  const logo = c.photo ? await loadImage(c.photo) : null
  const lastY = () => (pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0
  let y = 90

  const slimHeader = () => {
    pdf.setFillColor(...NAVY)
    pdf.rect(0, 0, W, 22, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(255, 255, 255)
    pdf.text(c.name, MX, 14)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`${doc.title} · ${period}`, W - MX, 14, { align: 'right' })
  }

  const fullHeader = () => {
    pdf.setFillColor(...NAVY)
    pdf.rect(0, 0, W, 66, 'F')
    pdf.setFillColor(...GOLD)
    pdf.rect(0, 66, W, 2.5, 'F')
    let tx = MX
    if (logo) {
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(MX, 13, 40, 40, 6, 6, 'F')
      try {
        pdf.addImage(logo, imgFormat(logo), MX + 3, 16, 34, 34)
      } catch { /* logo is decorative — ignore decode failures */ }
      tx = MX + 52
    } else {
      pdf.setFillColor(...GOLD)
      pdf.circle(MX + 20, 33, 18, 'F')
      pdf.setTextColor(...NAVY)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.text(mono(c.name) || 'HS', MX + 20, 38, { align: 'center' })
      tx = MX + 46
    }
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text(c.name, tx, 31)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(203, 213, 225)
    const contact = [c.contact, c.code && `Branch ${c.code}`].filter(Boolean).join('   ·   ')
    if (contact) pdf.text(contact, tx, 45)

    pdf.setTextColor(...GOLD)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(doc.title.toUpperCase(), W - MX, 26, { align: 'right' })
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(9.5)
    pdf.text(period, W - MX, 40, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(203, 213, 225)
    pdf.text(`Generated ${generated}${prepared ? `  ·  ${prepared}` : ''}`, W - MX, 52, { align: 'right' })
  }

  const need = (h: number) => {
    if (y + h > H - BOTTOM) {
      pdf.addPage()
      slimHeader()
      y = TOP
    }
  }

  const sheetTitle = (sheet: Element) => {
    const head = sheet.querySelector('[data-sheet-head]')
    const title = head?.querySelector('h2')?.textContent?.trim() ?? ''
    const sub = head?.querySelector('p')?.textContent?.trim() ?? ''
    need(34)
    pdf.setFillColor(...GOLD)
    pdf.rect(MX, y - 8, 3, 13, 'F')
    pdf.setTextColor(...NAVY)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10.5)
    pdf.text(title, MX + 9, y + 2)
    y += 10
    if (sub) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.setTextColor(...GRAY)
      pdf.text(sub, MX + 9, y + 4)
      y += 12
    }
    y += 6
  }

  const onPage = (d: { pageNumber: number }) => {
    if (d.pageNumber > 1) slimHeader()
  }

  const emitTable = (el: HTMLTableElement) => {
    autoTable(pdf, {
      html: el,
      startY: y,
      margin: { left: MX, right: MX, top: TOP, bottom: BOTTOM },
      theme: 'grid',
      styles: {
        font: 'helvetica', fontSize: 7, cellPadding: 3, lineColor: LINE, lineWidth: 0.5,
        textColor: INK, overflow: 'linebreak', valign: 'top',
      },
      headStyles: { fillColor: HEAD_FILL, textColor: HEAD_TEXT, fontStyle: 'bold', fontSize: 6.6 },
      footStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ALT_FILL },
      showFoot: 'lastPage',
      didParseCell(d) {
        const raw = d.cell.raw
        if (!(raw instanceof HTMLElement)) return
        const lines = (raw.innerText ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
        if (lines.length > 1) d.cell.text = lines
        const align = window.getComputedStyle(raw).textAlign
        if (align === 'right' || align === 'end') d.cell.styles.halign = 'right'
        else if (align === 'center') d.cell.styles.halign = 'center'
      },
      didDrawPage: onPage,
    })
    y = lastY() + 14
  }

  const isVal = (s: string) => /^(KES|KSH|—|–|-|\+|\(|\d)/i.test(s)
  const isBand = (s: string) => s === s.toUpperCase() && /[A-Z]/.test(s)

  type CellStyle = {
    halign?: 'left' | 'center' | 'right'
    fontStyle?: 'normal' | 'bold' | 'italic' | 'bolditalic'
    fontSize?: number
    fillColor?: [number, number, number]
    textColor?: [number, number, number]
  }
  type CellDef = { content: string; colSpan?: number; styles?: CellStyle }

  /** Label/value lists (stat cards, summary boxes) — pairs a label line with a
   *  following value line so it prints like the on-screen boxes. */
  const emitText = (lines: string[]) => {
    const body: CellDef[][] = []
    for (let i = 0; i < lines.length; i++) {
      const a = lines[i]
      const b = lines[i + 1]
      if (b !== undefined && isVal(b) && !isVal(a)) {
        body.push([{ content: a, styles: { textColor: GRAY } }, { content: b, styles: { halign: 'right', fontStyle: 'bold', textColor: INK } }])
        i++
      } else {
        body.push([{
          content: a,
          colSpan: 2,
          styles: isBand(a)
            ? { fontStyle: 'bold', fontSize: 6.6, fillColor: HEAD_FILL, textColor: HEAD_TEXT }
            : { textColor: GRAY },
        }])
      }
    }
    autoTable(pdf, {
      body,
      startY: y,
      margin: { left: MX, right: MX, top: TOP, bottom: BOTTOM },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 7, cellPadding: { top: 2.5, bottom: 2.5, left: 5, right: 5 }, lineColor: LINE, lineWidth: 0.4, textColor: INK },
      didDrawPage: onPage,
    })
    y = lastY() + 14
  }

  fullHeader()
  let pending: string[] = []
  const flush = () => {
    if (pending.length) {
      emitText(pending)
      pending = []
    }
  }
  for (const child of Array.from(root.children)) {
    if (child.matches('[data-report-toolbar]')) continue
    if (child.matches('[data-report-sheet]')) {
      flush()
      sheetTitle(child)
    }
    for (const block of blocksOf(child)) {
      if (block.kind === 'table') {
        flush()
        emitTable(block.el)
      } else {
        pending.push(...block.lines)
      }
    }
  }
  flush()

  const pages = pdf.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(...LINE)
    pdf.setLineWidth(0.5)
    pdf.line(MX, H - 20, W - MX, H - 20)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...GRAY)
    pdf.text(`${c.name}${c.code ? ` · Branch ${c.code}` : ''} — generated ${generated}`, MX, H - 9)
    pdf.text(`Page ${i} of ${pages}`, W - MX, H - 9, { align: 'right' })
  }
  pdf.save(`${slug(doc.title)}-${doc.fromD}-to-${doc.toD}.pdf`)
}
