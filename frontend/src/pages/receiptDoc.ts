import { dayRestHours, type Booking, type BookingPayment } from '../lib/bnb'
import { formatMoney } from '../lib/hr'
import { companyOf, escHtml, mono, stamp, type Company } from './accounts/reportDoc'

/** One charge line on a guest receipt — a room's charge or an extra package. */
export interface ReceiptLine {
  /** Who the charge belongs to — matches the booking's room-holders. */
  guest: string
  /** What was sold — the room (+ its type) or the package name. */
  label: string
  /** Supporting text — the stay period, nights and rate, or 'Extra package'. */
  detail: string
  amount: number
}

/** One money transaction on a booking, in the shape a receipt prints. */
export interface ReceiptPayment {
  payer: string
  /** Method label — 'M-Pesa', 'Cash', 'Deposit', … */
  method: string
  /** Receipt number — '—' for a deposit (they carry no receipt number). */
  receipt: string
  ref: string
  /** ISO timestamp the money moved (or was recorded). */
  when: string
  amount: number
}

/** A recorded booking payment → receipt shape. */
export const receiptPayment = (p: BookingPayment): ReceiptPayment => ({
  payer: p.payer,
  method: p.method_label,
  receipt: p.receipt_number || '—',
  ref: p.reference,
  when: p.paid_at ?? p.created_at,
  amount: Number(p.amount),
})

/** A reservation's deposit → receipt shape (deposits carry no receipt number). */
export const depositPayment = (b: Booking): ReceiptPayment => ({
  payer: b.guest_name,
  method: 'Deposit',
  receipt: '—',
  ref: '',
  when: b.created_at,
  amount: Number(b.deposit ?? 0),
})

const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** The stay period for the receipt's summary band — times for a day rest. */
const period = (b: Booking) => {
  const s = new Date(b.start), e = new Date(b.end)
  const d = (x: Date) => x.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
  const t = (x: Date) => x.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (b.kind === 'day_rest') {
    const h = dayRestHours(b)
    return `${d(s)} · ${t(s)} → ${t(e)} (${h} ${h === 1 ? 'hour' : 'hours'})`
  }
  return `${d(s)} → ${d(e)} · ${b.nights} ${b.nights === 1 ? 'night' : 'nights'}`
}

/** The hidden host everything prints through — app chrome stays out of the
 *  printout because only #report-print is visible to @media print. */
const printHost = () => {
  let host = document.getElementById('report-print')
  if (!host) {
    host = document.createElement('div')
    host.id = 'report-print'
    document.body.appendChild(host)
  }
  return host
}

const dash = '<div class="rc-dash"></div>'

/** Centered brand block — the letterhead a till receipt carries on top. */
const brand = (c: Company) => `
  <div class="rc-brand">
    ${c.photo
      ? `<img class="rc-logo" src="${escHtml(c.photo)}" alt="" />`
      : `<span class="rc-logo rc-mono">${escHtml(mono(c.name) || 'HS')}</span>`}
    <p class="rc-company">${escHtml(c.name)}</p>
    ${c.contact ? `<p class="rc-contact">${escHtml(c.contact)}</p>` : ''}
    ${c.code ? `<p class="rc-contact">Branch ${escHtml(c.code)}</p>` : ''}
  </div>`

/** Document identity under the brand — title plus small centred meta lines. */
const docTitle = (title: string, subs: string[]) => `
  <p class="rc-title">${escHtml(title)}</p>
  ${subs.map((s) => `<p class="rc-meta">${s}</p>`).join('')}`

/** A label/value row — label left, value right; wraps on narrow paper. */
const row = (label: string, value: string, cls = '') =>
  `<div class="rc-row${cls}"><span>${escHtml(label)}</span><b>${escHtml(value)}</b></div>`

/** A sold line — description (plus detail) on the left, amount on the right. */
const line = (label: string, detail: string, amount: string | number) => `
  <div class="rc-line">
    <div class="rc-left">
      <p class="rc-what">${escHtml(label)}</p>
      ${detail ? `<p class="rc-det">${escHtml(detail)}</p>` : ''}
    </div>
    <b class="rc-amt">${escHtml(formatMoney(amount))}</b>
  </div>`

/** The bill / paid / balance rows near the receipt's foot. */
const totals = (b: Booking) => {
  const balance = Number(b.balance)
  return [
    row('Bill', formatMoney(b.bill)),
    row('Paid', formatMoney(b.paid)),
    row(balance > 0 ? 'Balance due' : balance < 0 ? 'Credit to guest' : 'Settled', formatMoney(Math.abs(balance)), ' rc-total'),
  ].join('')
}

const roomsOf = (b: Booking) =>
  [b.room_name, ...(b.companions ?? []).map((g) => g.room_name)].filter(Boolean).join(', ')

/** Print the guest's receipt for a booking — the bill lines, the money
 *  collected (with each payment's receipt number) and the balance — laid out
 *  like a till receipt so it fits A4, 80 mm and 58 mm paper alike. */
export async function printReceipt(b: Booking, lines: ReceiptLine[]) {
  const c = await companyOf()
  const generated = stamp()

  // Charge lines grouped per room-holder so each guest sees their own bill.
  const grouped: [string, ReceiptLine[]][] = []
  for (const l of lines) {
    const last = grouped[grouped.length - 1]
    if (last && last[0] === l.guest) last[1].push(l)
    else grouped.push([l.guest, [l]])
  }
  const manyGuests = grouped.length > 1
  const charges = grouped.map(([guest, ls]) => `
    ${manyGuests ? `<p class="rc-who">${escHtml(guest)}</p>` : ''}
    ${ls.map((l) => line(l.label, l.detail, l.amount)).join('')}`).join('')

  // Money received — a reservation's deposit plus every recorded payment.
  const money = [
    ...(Number(b.deposit) > 0 ? [depositPayment(b)] : []),
    ...(b.payments ?? []).filter((p) => Number(p.amount) > 0).map(receiptPayment),
  ]
  const manyPayers = new Set(money.map((m) => m.payer)).size > 1
  const paid = money.map((m) =>
    line(
      `${m.method}${m.receipt !== '—' ? ` · ${m.receipt}` : ''}`,
      [fmtDT(m.when), m.ref, manyPayers ? `Paid by ${m.payer}` : ''].filter(Boolean).join(' · '),
      m.amount,
    )).join('')

  const rooms = roomsOf(b)
  const later = (b.payments ?? []).some((p) => p.method === 'later')

  printHost().innerHTML = `
    <div class="rc-doc">
      ${brand(c)}
      ${dash}
      ${docTitle('Guest receipt', [
        `Booking #${b.id} · ${escHtml(b.kind_label)} · ${escHtml(b.status_label)}`,
        `Printed ${escHtml(generated)}`,
      ])}
      ${dash}
      ${row('Client', b.guest_name)}
      ${b.guest_phone ? row('Phone', b.guest_phone) : ''}
      ${rooms ? row(rooms.includes(',') ? 'Rooms' : 'Room', rooms) : ''}
      ${row('Period', period(b))}
      ${b.created_by_name ? row('Served by', b.created_by_name) : ''}
      ${dash}

      <p class="rc-sec">Charges</p>
      ${charges}
      ${dash}
      ${row('Total bill', formatMoney(b.bill), ' rc-total')}
      ${money.length ? `
      ${dash}
      <p class="rc-sec">Payments received</p>
      ${paid}
      ${dash}
      ${row('Total received', formatMoney(b.paid), ' rc-total')}` : ''}
      ${dash}
      ${totals(b)}
      ${dash}

      ${b.tax_reference ? `<p class="rc-note">Tax reference: ${escHtml(b.tax_reference)}</p>` : ''}
      ${later ? `<p class="rc-note">Marked pay-later — the balance is settled progressively before checkout.</p>` : ''}
      <p class="rc-thanks">Thank you for staying with us</p>
      <p class="rc-meta">${escHtml(c.name)}${c.code ? ` · Branch ${escHtml(c.code)}` : ''}</p>
    </div>`

  window.print()
}

/** Print the receipt for a single payment — the transaction in a band of its
 *  own, then the booking's money position after it. `reprint` marks the copy
 *  as a reprint so duplicates read differently from the desk's first print. */
export async function printPaymentReceipt(b: Booking, p: ReceiptPayment, opts: { reprint?: boolean } = {}) {
  const c = await companyOf()
  const generated = stamp()

  printHost().innerHTML = `
    <div class="rc-doc">
      ${brand(c)}
      ${dash}
      ${docTitle('Payment receipt', [
        `${p.receipt !== '—' ? `Receipt ${escHtml(p.receipt)} · ` : ''}Booking #${b.id} · ${escHtml(b.kind_label)} · ${escHtml(b.status_label)}`,
        `${opts.reprint ? 'Reprinted' : 'Printed'} ${escHtml(generated)}`,
      ])}
      ${dash}
      <div class="rc-amount"><span>Amount received</span><strong>${escHtml(formatMoney(p.amount))}</strong></div>
      ${dash}
      ${row('Received from', p.payer)}
      ${row('Method', p.method)}
      ${row('Receipt no.', p.receipt)}
      ${row('Reference', p.ref || '—')}
      ${row('Time paid', fmtDT(p.when))}
      ${dash}
      ${row('Client', b.guest_name)}
      ${b.guest_phone ? row('Phone', b.guest_phone) : ''}
      ${b.room_name ? row('Room', b.room_name) : ''}
      ${row('Period', period(b))}
      ${b.created_by_name ? row('Served by', b.created_by_name) : ''}
      ${dash}
      ${totals(b)}
      ${dash}

      ${b.tax_reference ? `<p class="rc-note">Tax reference: ${escHtml(b.tax_reference)}</p>` : ''}
      <p class="rc-thanks">Thank you for staying with us</p>
      <p class="rc-meta">${escHtml(c.name)}${c.code ? ` · Branch ${escHtml(c.code)}` : ''}</p>
    </div>`

  window.print()
}
