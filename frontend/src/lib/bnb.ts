import { api, share, type Role } from './api'

export type BranchStatus = 'active' | 'suspended'

export interface Branch {
  id: number
  name: string
  phone: string
  email: string
  location: string
  code: string
  status: BranchStatus
  photo: string | null
  created_at: string
}

export interface BranchRegister {
  name: string
  phone: string
  email: string
  location: string
  code: string
  password: string
  confirm_password: string
}

export type BranchEdit = Partial<BranchRegister> & { status?: BranchStatus }

/** The branch's own profile — details plus its payment and guest-messaging
 *  settings — edited by the manager from Branch settings. */
export interface BranchProfile {
  id: number
  name: string
  phone: string
  email: string
  location: string
  code: string
  status: BranchStatus
  status_label: string
  photo: string | null
  // Payments
  mpesa_enabled: boolean
  mpesa_till: string
  mpesa_account: string
  cash_enabled: boolean
  card_enabled: boolean
  bank_enabled: boolean
  bank_name: string
  bank_account_name: string
  bank_account_number: string
  // Payment API keys
  mpesa_consumer_key: string
  mpesa_consumer_secret: string
  mpesa_passkey: string
  card_api_key: string
  card_api_secret: string
  // Communications
  email_enabled: boolean
  sms_enabled: boolean
  sms_sender_id: string
  whatsapp_enabled: boolean
  whatsapp_number: string
  // Communication API keys
  email_api_key: string
  sms_api_key: string
  sms_api_username: string
  whatsapp_api_key: string
  // Guest message drafts, keyed by trigger
  message_templates: Record<string, MessageDraft>
  // Branch hours — "HH:MM[:SS]" or null
  opens_at: string | null
  closes_at: string | null
  checkin_from: string | null
  checkout_by: string | null
  // Appearance — workspace theme name per staff role
  role_themes: Partial<Record<Role, string>>
  updated_at: string
}

export type MessageChannel = 'email' | 'sms' | 'whatsapp'

export interface MessageDraft {
  enabled: boolean
  channel: MessageChannel
  subject: string
  body: string
}

export type BranchProfileEdit = Partial<Omit<BranchProfile, 'id' | 'code' | 'status' | 'status_label' | 'updated_at'>>

export type RoomStatus = 'active' | 'maintenance' | 'suspended'
export type RoomType = 'single' | 'double' | 'twin' | 'queen' | 'king' | 'deluxe' | 'executive' | 'suite' | 'family'

export interface RoomPhoto {
  id: number
  url: string
  thumb: string
  position: number
}

export interface Room {
  id: number
  branch: number
  branch_name: string | null
  name: string
  room_type: RoomType
  type_label: string
  capacity: number
  price: string
  /** Flat day-rest rate; null falls back to `price`. */
  day_rest_price: string | null
  /** Commission this room pays out on a booking; null means none. */
  commission: string | null
  description: string
  status: RoomStatus
  status_label: string
  status_reason: string
  /** Main photo thumbnail URL (first of `photos`), for fast list rendering. */
  photo: string | null
  photos: RoomPhoto[]
  created_at: string
}

export interface RoomRegister {
  name: string
  room_type: RoomType
  capacity: number
  price: string
  day_rest_price?: string | null
  commission?: string | null
  description: string
}

export type RoomEdit = Partial<RoomRegister> & { status?: RoomStatus; status_reason?: string }

/** Preset reasons offered when suspending a room; the user can also type a custom one. */
export const SUSPEND_REASONS = [
  'Renovation or repairs',
  'Plumbing issue',
  'Electrical fault',
  'Safety concern',
  'Pest control',
  'Deep cleaning',
  'Seasonal closure',
]

export type BookingKind = 'reservation' | 'stay' | 'day_rest'
export type BookingStatus = 'reserved' | 'occupied' | 'completed' | 'cancelled'
export type GuestIdType = 'national_id' | 'passport' | 'driving_licence' | 'other'

export const GUEST_ID_TYPES: { value: GuestIdType; label: string }[] = [
  { value: 'national_id', label: 'National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_licence', label: 'Driving licence' },
  { value: 'other', label: 'Other document' },
]

/** An extra guest on a booking — `guest_*` on Booking is always the primary guest.
 *  `room` is this guest's own room (null = shares the main room); `start`/`end`
 *  are this guest's own period (null = same as the booking's). */
export interface BookingGuest {
  id: number
  name: string
  phone: string
  email: string
  id_type: GuestIdType | ''
  id_type_label: string | null
  id_number: string
  nationality: string
  notes: string
  room: number | null
  room_name: string | null
  start: string | null
  end: string | null
  /** This guest's agreed room rate — null bills the room's listed price. */
  rate: string | null
}

/** `later` is not a money channel — a zero-amount marker meaning the guest
 *  pays the balance progressively after check-in. */
export type PaymentMethod = 'mpesa' | 'cash' | 'visa' | 'bank' | 'other' | 'later'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cash', label: 'Cash' },
  { value: 'visa', label: 'Visa' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

/** Method picks for a check-in payment row — the money channels plus the
 *  pay-later marker for guests settling progressively. */
export const CHECKIN_METHODS: { value: PaymentMethod; label: string }[] = [
  ...PAYMENT_METHODS,
  { value: 'later', label: 'Pay later' },
]

/** Money received for a booking — `companion` null means the main guest paid. */
export interface BookingPayment {
  id: number
  companion: number | null
  payer: string
  amount: string
  method: PaymentMethod
  method_label: string
  receipt_number: string
  reference: string
  /** When the money actually moved — null means it was paid as it was recorded. */
  paid_at: string | null
  created_at: string
}

export interface BookingPaymentRegister {
  /** Party position: 0 = main guest, n = the nth extra guest. */
  guest: number
  amount: number
  method: PaymentMethod
  reference?: string
  /** When the money actually moved — optional, defaults to the record time. */
  paid_at?: string | null
}

/** An extra package picked for a guest on a booking — the catalogue name and
 *  price snapshot onto the row when sold, so later edits don't rewrite bills. */
export interface BookingPackage {
  id: number
  /** The catalogue package id — null once the package is deleted. */
  package: number | null
  /** Who the package is for (main guest or an extra guest's name). */
  payer: string
  name: string
  amount: string
  created_at: string
}

export interface BookingPackageRegister {
  /** Party position: 0 = main guest, n = the nth extra guest. */
  guest: number
  package: number
}

export type ReferralMaturity = 'partial' | 'matured' | 'void'

/** A referral links a new client's booking to whoever sent them. The gift voucher
 *  can be redeemed once `maturity` is 'matured' — the client paid for the room. */
export interface Referral {
  id: number
  booking: number
  guest_name: string
  guest_phone: string
  room_name: string | null
  booking_status: BookingStatus
  booking_status_label: string
  referrer_name: string
  referrer_phone: string
  voucher_code: string
  maturity: ReferralMaturity
  maturity_label: string
  paid: string
  /** The booking's bill — rooms plus extra packages. */
  billed: string
  redeemed_at: string | null
  redeemed_by_name: string | null
  created_at: string
}

export interface Booking {
  id: number
  branch: number
  branch_name: string | null
  room: number
  room_name: string | null
  guest_name: string
  guest_phone: string
  guest_email: string
  guest_id_type: GuestIdType | ''
  guest_id_type_label: string | null
  guest_id_number: string
  guest_nationality: string
  guests: number
  guest_notes: string
  companions: BookingGuest[]
  payments: BookingPayment[]
  /** Extra packages sold on this booking — billed on top of the rooms. */
  packages: BookingPackage[]
  kind: BookingKind
  kind_label: string
  status: BookingStatus
  status_label: string
  start: string
  end: string
  nights: number
  deposit: string | null
  /** Tax invoice / reference code recorded at the desk — optional. */
  tax_reference: string
  /** The agreed room rate — a stay's nightly rate, a day rest's flat charge.
   *  null means the room bills its listed price. */
  rate: string | null
  /** Estimated charge — every booked room × its billed nights (day rest = flat)
   *  plus any extra packages sold on the booking. */
  bill: string
  /** Money received — deposit plus recorded payments. */
  paid: string
  /** `bill` − `paid`; negative means overpaid. */
  balance: string
  referral: Referral | null
  /** Credit vouchers this booking issued through room changes — never expire. */
  vouchers: Voucher[]
  created_by_name: string | null
  created_at: string
}

/** A downgrade balance the guest took as a voucher instead of a refund. */
export interface Voucher {
  id: number
  code: string
  amount: string
  redeemed_at: string | null
  created_at: string
}

/** How a room change settles the price difference on the unused nights. */
export type RoomChangeOption = 'switch' | 'refund' | 'extend' | 'voucher' | 'topup' | 'shorten' | 'split'

export interface RoomChangeRequest {
  room: number
  option: RoomChangeOption
  /** `split` only — how many of the remaining nights to keep in the new room. */
  nights?: number
  /** The channel a top-up comes in or a refund leaves through. */
  method?: PaymentMethod
  reference?: string
}

/** The server's quote + outcome for a change-room call. */
export interface RoomChangeResult {
  booking: Booking
  applied: {
    option: RoomChangeOption
    nights_left: number
    /** nights_left × the old room's rate — the credit moving rooms. */
    credit: string
    /** nights_left × the new room's rate. */
    cost: string
    /** credit − cost: positive pays the guest back, negative is the shortfall. */
    difference: string
    refund?: string
    topup?: string
    voucher_code?: string
    voucher_amount?: string
    extra_nights?: number
    kept_nights?: number
    /** The odd amount that can't buy a night — stays on the booking as credit. */
    leftover?: string
  }
}

/** A top-up on a live stay — `extend_nights` also buys extra nights on the same room. */
/** What happens to money already collected when a booking is cancelled. */
export type CancelSettle = 'keep' | 'refund' | 'voucher'

export interface CancelRequest {
  /** 'refund' hands the paid balance back through `method` (needs an open
   *  till), 'voucher' issues a redeemable credit voucher; 'keep' leaves the
   *  money on record as a refund due. */
  settle?: CancelSettle
  /** The channel a refund leaves through. */
  method?: PaymentMethod
  reference?: string
}

export interface PayRequest {
  amount: number
  method: PaymentMethod
  reference?: string
  /** When the money actually moved — optional, defaults to the record time. */
  paid_at?: string | null
  /** Push checkout out by this many nights — the room must stay free past checkout. */
  extend_nights?: number
}

export interface PayResult {
  booking: Booking
  applied: {
    amount: string
    extra_nights?: number
    /** The extra nights' total at the room's nightly rate. */
    cost?: string
  }
}

/** Direct field edits on a booking — today that's the agreed `rate` behind the
 *  bill; null reverts the room to its listed price. */
export interface BookingEdit {
  rate?: number | null
}

/** Sell an extra package on a live booking — `method` collects the price in the same call. */
export interface AddPackageRequest {
  package: number
  /** Party position: 0 = main guest, n = the nth extra guest. */
  guest?: number
  /** Collect the package price now through this channel — needs an open till. */
  method?: PaymentMethod
  reference?: string
}

export interface AddPackageResult {
  booking: Booking
  applied: {
    name: string
    amount: string
    /** Present when the payment was collected on the spot. */
    paid?: string
  }
}

export interface BookingRegister {
  room: number
  guest_name: string
  guest_phone?: string
  guest_email?: string
  guest_id_type?: GuestIdType | ''
  guest_id_number?: string
  guest_nationality?: string
  guest_notes?: string
  companions?: (Omit<BookingGuest, 'id' | 'id_type_label' | 'room_name' | 'rate'> & { rate?: number | null })[]
  payments?: BookingPaymentRegister[]
  /** Extra packages picked per guest — same party-position key as payments. */
  packages?: BookingPackageRegister[]
  /** Referral capture — the referrer's name and phone, sent as a pair for new clients. */
  referrer_name?: string
  referrer_phone?: string
  guests: number
  kind: BookingKind
  start: string
  end: string
  deposit?: number | null
  /** Tax invoice / reference code for the bill — optional. */
  tax_reference?: string
  /** The agreed room rate — a stay's nightly rate, a day rest's flat charge.
   *  null/omitted bills the room's listed price. */
  rate?: number | null
}

/** Hours a day-rest booking occupies the room, derived from its start and end. */
export const dayRestHours = (b: Booking) =>
  Math.max(1, Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 3_600_000))

/** How long a booking lasts as display text — hours for a day rest, nights otherwise. */
export const stayLength = (b: Booking) =>
  b.kind === 'day_rest'
    ? `${dayRestHours(b)} ${dayRestHours(b) === 1 ? 'hour' : 'hours'}`
    : `${b.nights} ${b.nights === 1 ? 'night' : 'nights'}`

/** Groups a guest's bookings into one client — ID number is the strongest key,
 *  then phone, email, name. The key feeds the client-portal URL. */
export const clientKey = (b: Booking) => {
  const id = b.guest_id_number.trim().toLowerCase()
  if (id) return `id:${id.replace(/\//g, '_')}`
  const ph = b.guest_phone.replace(/\D/g, '')
  if (ph) return `ph:${ph}`
  const em = b.guest_email.trim().toLowerCase()
  if (em) return `em:${em.replace(/\//g, '_')}`
  return `nm:${b.guest_name.trim().toLowerCase().replace(/\//g, '_')}`
}

export type TicketCategory = 'maintenance' | 'housekeeping' | 'guest_request' | 'complaint' | 'it_system' | 'inventory' | 'other'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'resolved' | 'closed' | 'reopened'
export type TicketSource = 'reception' | 'phone' | 'guest_portal' | 'housekeeping_app' | 'other'

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'guest_request', label: 'Guest request' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'it_system', label: 'IT/System' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'other', label: 'Other' },
]

export const TICKET_PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export const TICKET_STATUSES: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'reopened', label: 'Reopened' },
]

export const TICKET_SOURCES: { value: TicketSource; label: string }[] = [
  { value: 'reception', label: 'Reception' },
  { value: 'phone', label: 'Phone' },
  { value: 'guest_portal', label: 'Guest portal' },
  { value: 'housekeeping_app', label: 'Housekeeping app' },
  { value: 'other', label: 'Other' },
]

export interface TicketAttachment {
  id: number
  url: string
  name: string
  created_at: string
}

/** A part/material used resolving a ticket — name plus unit price (decimal as string). */
export interface TicketItem {
  id: number
  name: string
  price: string
}

export interface Ticket {
  id: number
  number: string
  branch: number
  branch_name: string | null
  title: string
  description: string
  category: TicketCategory
  category_label: string
  priority: TicketPriority
  priority_label: string
  status: TicketStatus
  status_label: string
  room: number | null
  room_name: string | null
  location: string
  booking: number | null
  guest_name: string | null
  reported_by_name: string | null
  reporter_name: string
  source: TicketSource
  source_label: string
  assigned_to: number | null
  assigned_to_name: string | null
  assignee_name: string
  due: string | null
  supplier_name: string
  supplier_phone: string
  started_on: string | null
  hold_reason: string
  held_on: string | null
  labour_cost: string | null
  payment_ref: string
  reopen_reason: string
  reopened_on: string | null
  resolved_at: string | null
  items: TicketItem[]
  items_total: string
  attachments: TicketAttachment[]
  created_at: string
}

export interface TicketRegister {
  title: string
  description?: string
  category: TicketCategory
  priority: TicketPriority
  status?: TicketStatus
  room?: number | null
  location?: string
  booking?: number | null
  reporter_name?: string
  source: TicketSource
  assigned_to?: number | null
  assignee_name?: string
  due?: string | null
}

export type TicketEdit = Partial<TicketRegister> & {
  status?: TicketStatus
  supplier_name?: string
  supplier_phone?: string
  started_on?: string
  hold_reason?: string
  held_on?: string
  labour_cost?: string | number
  payment_ref?: string
  reopen_reason?: string
  reopened_on?: string
  items?: { name: string; price: string | number }[]
}

/** A staff member a ticket can be assigned to. */
export interface StaffChoice {
  id: number
  name: string
  role: string
}

/** Server-side filters for the bookings list — boards ask for a small slice
 *  (live stays, newest N) instead of the whole table. */
export interface BookingQuery {
  /** Only live bookings (reserved + occupied). */
  active?: '1'
  /** Comma-separated statuses — e.g. 'reserved', 'completed,cancelled'. */
  status?: string
  /** 'reservation' | 'stay' | 'day_rest'. */
  kind?: BookingKind
  /** Only bookings whose stay ends on/after this ISO datetime. */
  end_from?: string
  /** Only stays on this room — account drill-down. */
  room?: number
  /** One client's bookings — the rollup key the directory assigns, e.g. 'ph:2547…'. */
  client?: string
  /** Newest N rows — the server caps this at 500. */
  limit?: number
}

/** Per-room money rollup — the accounts page's ledger rows. */
export interface RoomAccountRow {
  room: number
  bookings: number
  nights: number
  /** nights × room price, across paying bookings. */
  billed: string
  deposits: string
}

/** A client rolled up across their bookings — the directory row. */
export interface ClientRow {
  /** Stable rollup key (id:… / ph:… / em:… / nm:…) — also the portal URL slug. */
  key: string
  name: string
  phone: string
  email: string
  id_type: GuestIdType | ''
  id_number: string
  nationality: string
  notes: string
  bookings: number
  /** Non-cancelled bookings. */
  stays: number
  nights: number
  billed: string
  /** Deposits + payments received, across non-cancelled bookings. */
  paid: string
  last_visit: string
  since: string
  in_house: boolean
  /** Any booking still awaiting check-in. */
  has_reservation: boolean
  /** Any non-cancelled day-rest booking — live sessions and past ones. */
  has_day_rest: boolean
  /** Any booking overlapping the requested range, and stays among them. */
  in_range: boolean
  visits: number
  /** Barred from new bookings at this branch. */
  suspended: boolean
  /** Why the hold was placed — empty when not suspended. */
  suspend_reason: string
}

/** Editable client profile fields — updates fan out to every booking under the
 *  rollup key. `status` suspends or reinstates the client for new bookings. */
export interface ClientProfileEdit {
  guest_name?: string
  guest_phone?: string
  guest_email?: string
  guest_id_type?: GuestIdType | ''
  guest_id_number?: string
  guest_nationality?: string
  guest_notes?: string
  status?: 'active' | 'suspended'
  reason?: string
}

export interface ClientProfileResult {
  /** The rollup key after the edit — profile changes can move the client. */
  key: string
  suspended: boolean
  reason: string
}

export interface ClientRollup {
  clients: ClientRow[]
  /** Years with bookings — feeds the year filter's options. */
  years: number[]
}

export type PackageCategory = 'food' | 'travel' | 'tourist' | 'safe_storage' | 'other'
export type PackageStatus = 'active' | 'suspended'

export const PACKAGE_CATEGORIES: { value: PackageCategory; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'travel', label: 'Travel' },
  { value: 'tourist', label: 'Tourist' },
  { value: 'safe_storage', label: 'Safe storage' },
  { value: 'other', label: 'Other' },
]

/** An add-on a branch sells on top of a stay — a spa session, dinner, airport pickup… */
export interface ExtraPackage {
  id: number
  branch: number
  branch_name: string | null
  category: PackageCategory
  category_label: string
  name: string
  description: string
  amount: string
  image: string | null
  status: PackageStatus
  status_label: string
  created_at: string
}

export interface PackageRegister {
  category: PackageCategory
  name: string
  description?: string
  amount: string
}

export type PackageEdit = Partial<PackageRegister> & { status?: PackageStatus }

/** Server-side filters for the tickets list. */
export interface TicketQuery {
  /** Comma-separated statuses. */
  status?: string
  /** Newest N rows — the server caps this at 500. */
  limit?: number
}

export type ExpenseCategory = 'supplies' | 'utilities' | 'maintenance' | 'salaries' | 'transport' | 'marketing' | 'food_beverage' | 'other'

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'supplies', label: 'Supplies' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'salaries', label: 'Salaries & wages' },
  { value: 'transport', label: 'Transport' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'food_beverage', label: 'Food & beverage' },
  { value: 'other', label: 'Other' },
]

export type PayStatus = 'pending' | 'paid'

export const PAY_STATUSES: { value: PayStatus; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
]

/** A supplier/payee — registered automatically by expense and stock records. */
export interface Supplier {
  id: number
  name: string
  phone: string
}

/** A branch expense — recorded from Accounts → Register expenses. */
export interface Expense {
  id: number
  branch: number
  branch_name: string | null
  /** The till session it was registered under (null on pre-till records). */
  session: number | null
  category: ExpenseCategory
  category_label: string
  name: string
  amount: string
  supplier_name: string
  supplier_phone: string
  payment_status: PayStatus
  payment_status_label: string
  created_by_name: string | null
  created_at: string
}

export interface ExpenseRegister {
  category: ExpenseCategory
  name: string
  amount: number
  supplier_name: string
  supplier_phone?: string
  payment_status: PayStatus
}

export type ExpenseEdit = Partial<ExpenseRegister>

/** Stock bought from an outside supplier — `unit_price` is the buying price each. */
export interface StockPurchase {
  id: number
  branch: number
  branch_name: string | null
  /** The till session it was registered under (null on pre-till records). */
  session: number | null
  supplier_name: string
  supplier_phone: string
  item: string
  quantity: number
  unit_price: string
  /** quantity × unit_price, as a decimal string. */
  total: string
  payment_status: PayStatus
  payment_status_label: string
  created_by_name: string | null
  created_at: string
}

export interface StockPurchaseRegister {
  supplier_name: string
  supplier_phone?: string
  item: string
  quantity: number
  unit_price: number
  payment_status: PayStatus
}

export type StockPurchaseEdit = Partial<StockPurchaseRegister>

/** The channel a till drawing left through. */
export type DrawingMethod = 'cash' | 'mpesa' | 'visa'

export const DRAWING_LABEL: Record<DrawingMethod, string> = { cash: 'Cash', mpesa: 'M-Pesa', visa: 'Visa card' }

/** Money taken out of the till mid-session. */
export interface TillDrawing {
  id: number
  method: DrawingMethod
  amount: string
  reason: string
  given_to: string
  created_by_name: string | null
  created_at: string
}

/** One till session — opened with cash, M-Pesa and card floats, closed with
 *  each channel's counted total. `*_in` is that channel's booking payments
 *  received in the window; `expected*` = float + in − channel drawings;
 *  `over_short*` = counted − expected. */
export interface TillSession {
  id: number
  branch: number
  branch_name: string | null
  status: 'open' | 'closed'
  /** Id + name of the receptionist holding the session — writes are theirs alone. */
  opened_by: number | null
  opened_by_name: string | null
  opened_at: string
  opening_float: string
  opening_mpesa: string
  opening_card: string
  note: string
  closed_by_name: string | null
  closed_at: string | null
  closing_count: string | null
  closing_mpesa: string | null
  closing_card: string | null
  closing_note: string
  drawings: TillDrawing[]
  /** All drawings combined, then each channel on its own. */
  drawings_total: string
  drawings_cash: string
  drawings_mpesa: string
  drawings_card: string
  /** Payments received during the session per channel, and how many there were. */
  cash_in: string
  cash_in_count: number
  mpesa_in: string
  mpesa_in_count: number
  card_in: string
  card_in_count: number
  /** What each channel should hold: opening + payments in − channel drawings. */
  expected: string
  expected_mpesa: string
  expected_card: string
  /** Counted − expected per channel (null while open or uncounted). */
  over_short: string | null
  over_short_mpesa: string | null
  over_short_card: string | null
}

export interface TillOpen {
  opening_float: number
  opening_mpesa?: number
  opening_card?: number
  note?: string
}

export interface TillClose {
  closing_count: number
  closing_mpesa?: number | null
  closing_card?: number | null
  closing_note?: string
}

export interface TillDrawingRegister {
  method: DrawingMethod
  amount: number
  reason?: string
  given_to?: string
}

export interface RoomPhotoEdit {
  /** New files to append, in order. */
  newPhotos?: File[]
  /** Existing photo ids to delete. */
  removeIds?: number[]
  /** "e:<photo id>" or "n:<new photo index>" — which picture becomes the main one. */
  mainToken?: string
}

export const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'twin', label: 'Twin' },
  { value: 'queen', label: 'Queen' },
  { value: 'king', label: 'King' },
  { value: 'deluxe', label: 'Deluxe' },
  { value: 'executive', label: 'Executive' },
  { value: 'suite', label: 'Suite' },
  { value: 'family', label: 'Family' },
]

export const bnb = {
  branches: share(() => api.get<Branch[]>('/bnb/branches/').then((r) => r.data)),
  registerBranch: (data: BranchRegister, photo: File | null) => {
    const form = new FormData()
    Object.entries(data).forEach(([k, v]) => form.append(k, v))
    if (photo) form.append('photo', photo)
    return api.post<Branch>('/bnb/branches/', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
  },
  /** `photo`: a File replaces the picture, `null` removes it, `undefined` keeps it. */
  updateBranch: (id: number, data: BranchEdit, photo?: File | null) => {
    if (photo instanceof File) {
      const form = new FormData()
      Object.entries(data).forEach(([k, v]) => v !== undefined && form.append(k, String(v)))
      form.append('photo', photo)
      return api.patch<Branch>(`/bnb/branches/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    }
    return api.patch<Branch>(`/bnb/branches/${id}/`, photo === null ? { ...data, photo: null } : data).then((r) => r.data)
  },
  deleteBranch: (id: number) => api.delete(`/bnb/branches/${id}/`),
  checkBranchCode: (code: string) =>
    api.get<{ code: string; available: boolean }>('/bnb/branches/code-check/', { params: { code } }).then((r) => r.data),

  /** The caller's own branch profile — details, payments and guest messaging. */
  myBranch: () => api.get<BranchProfile>('/bnb/my-branch/').then((r) => r.data),
  /** `photo`: a File replaces the picture, `null` removes it, `undefined` keeps it. */
  updateMyBranch: (data: BranchProfileEdit, photo?: File | null) => {
    if (photo instanceof File) {
      const form = new FormData()
      Object.entries(data).forEach(([k, v]) => v !== undefined && form.append(k, String(v)))
      form.append('photo', photo)
      return api.patch<BranchProfile>('/bnb/my-branch/', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    }
    return api.patch<BranchProfile>('/bnb/my-branch/', photo === null ? { ...data, photo: null } : data).then((r) => r.data)
  },

  rooms: share(() => api.get<Room[]>('/bnb/rooms/').then((r) => r.data)),
  /** `photos` upload in order — the first file becomes the room's main image. */
  registerRoom: (data: RoomRegister, photos: File[]) => {
    const form = new FormData()
    Object.entries(data).forEach(([k, v]) => form.append(k, String(v)))
    photos.forEach((p) => form.append('new_photos', p))
    return api.post<Room>('/bnb/rooms/', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
  },
  updateRoom: (id: number, data: RoomEdit, photos: RoomPhotoEdit = {}) => {
    const extras: Record<string, string> = {}
    if (photos.removeIds?.length) extras.remove_photos = photos.removeIds.join(',')
    if (photos.mainToken) extras.main_photo = photos.mainToken
    if (photos.newPhotos?.length) {
      const form = new FormData()
      Object.entries({ ...data, ...extras }).forEach(([k, v]) => v !== undefined && form.append(k, String(v)))
      photos.newPhotos.forEach((p) => form.append('new_photos', p))
      return api.patch<Room>(`/bnb/rooms/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    }
    return api.patch<Room>(`/bnb/rooms/${id}/`, { ...data, ...extras }).then((r) => r.data)
  },
  deleteRoom: (id: number) => api.delete(`/bnb/rooms/${id}/`),

  packages: share(() => api.get<ExtraPackage[]>('/bnb/packages/').then((r) => r.data)),
  /** `image` is the package picture — optional. */
  registerPackage: (data: PackageRegister, image: File | null) => {
    const form = new FormData()
    Object.entries(data).forEach(([k, v]) => v !== undefined && form.append(k, String(v)))
    if (image) form.append('image', image)
    return api.post<ExtraPackage>('/bnb/packages/', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
  },
  /** `image`: a File replaces the picture, `null` removes it, `undefined` keeps it. */
  updatePackage: (id: number, data: PackageEdit, image?: File | null) => {
    if (image instanceof File) {
      const form = new FormData()
      Object.entries(data).forEach(([k, v]) => v !== undefined && form.append(k, String(v)))
      form.append('image', image)
      return api.patch<ExtraPackage>(`/bnb/packages/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    }
    return api.patch<ExtraPackage>(`/bnb/packages/${id}/`, image === null ? { ...data, image: null } : data).then((r) => r.data)
  },
  deletePackage: (id: number) => api.delete(`/bnb/packages/${id}/`),

  bookings: share((params: BookingQuery = {}) => api.get<Booking[]>('/bnb/bookings/', { params }).then((r) => r.data)),
  roomAccounts: share(() => api.get<RoomAccountRow[]>('/bnb/bookings/accounts/').then((r) => r.data)),
  clientRollup: share((params: { from?: string; to?: string } = {}) =>
    api.get<ClientRollup>('/bnb/bookings/clients/', { params }).then((r) => r.data),
  ),
  /** Edit a client's profile — fans out to their bookings — or suspend/reinstate them. */
  updateClient: (key: string, data: ClientProfileEdit) =>
    api.patch<ClientProfileResult>(`/bnb/clients/${encodeURIComponent(key)}/`, data).then((r) => r.data),
  registerBooking: (data: BookingRegister) => api.post<Booking>('/bnb/bookings/', data).then((r) => r.data),
  /** Edit a booking's own fields — the agreed `rate` rebuilds its bill. */
  updateBooking: (id: number, data: BookingEdit) =>
    api.patch<Booking>(`/bnb/bookings/${id}/`, data).then((r) => r.data),
  checkinBooking: (id: number) => api.post<Booking>(`/bnb/bookings/${id}/checkin/`).then((r) => r.data),
  checkoutBooking: (id: number) => api.post<Booking>(`/bnb/bookings/${id}/checkout/`).then((r) => r.data),
  cancelBooking: (id: number, data?: CancelRequest) =>
    api.post<Booking>(`/bnb/bookings/${id}/cancel/`, data).then((r) => r.data),
  /** Move a live stay to another room — `option` settles the price difference on the unused nights. */
  changeRoom: (id: number, data: RoomChangeRequest) =>
    api.post<RoomChangeResult>(`/bnb/bookings/${id}/change-room/`, data).then((r) => r.data),
  /** Top up a live stay — `extend_nights` also buys extra nights on the same room. */
  payBooking: (id: number, data: PayRequest) =>
    api.post<PayResult>(`/bnb/bookings/${id}/pay/`, data).then((r) => r.data),
  /** Sell an extra package on a live stay — `method` collects the price on the spot. */
  addPackage: (id: number, data: AddPackageRequest) =>
    api.post<AddPackageResult>(`/bnb/bookings/${id}/add-package/`, data).then((r) => r.data),

  referrals: share((params: { limit?: number } = {}) => api.get<Referral[]>('/bnb/referrals/', { params }).then((r) => r.data)),
  /** Hand over the gift voucher — the referral must have matured (client paid). */
  redeemReferral: (id: number) => api.post<Referral>(`/bnb/referrals/${id}/redeem/`).then((r) => r.data),

  tickets: share((params: TicketQuery = {}) => api.get<Ticket[]>('/bnb/tickets/', { params }).then((r) => r.data)),
  ticketStaff: share(() => api.get<StaffChoice[]>('/bnb/tickets/staff/').then((r) => r.data)),
  /** `files` are photos, videos or documents to attach (max 10, 10 MB each). */
  registerTicket: (data: TicketRegister, files: File[]) => {
    const form = new FormData()
    Object.entries(data).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && form.append(k, String(v)))
    files.forEach((f) => form.append('new_files', f))
    return api.post<Ticket>('/bnb/tickets/', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
  },
  /** `files.newFiles` upload in order; `files.removeIds` deletes existing attachments. */
  updateTicket: (id: number, data: TicketEdit, files: { newFiles?: File[]; removeIds?: number[] } = {}) => {
    const extras: Record<string, string> = {}
    if (files.removeIds?.length) extras.remove_files = files.removeIds.join(',')
    if (files.newFiles?.length) {
      const form = new FormData()
      Object.entries({ ...data, ...extras }).forEach(([k, v]) =>
        v !== undefined && v !== null && form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v)),
      )
      files.newFiles.forEach((f) => form.append('new_files', f))
      return api.patch<Ticket>(`/bnb/tickets/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    }
    return api.patch<Ticket>(`/bnb/tickets/${id}/`, { ...data, ...extras }).then((r) => r.data)
  },
  deleteTicket: (id: number) => api.delete(`/bnb/tickets/${id}/`),

  /** Suppliers/payees for autocomplete — registered by expense and stock records. */
  suppliers: share(() => api.get<Supplier[]>('/bnb/suppliers/').then((r) => r.data)),

  expenses: share(() => api.get<Expense[]>('/bnb/expenses/').then((r) => r.data)),
  registerExpense: (data: ExpenseRegister) => api.post<Expense>('/bnb/expenses/', data).then((r) => r.data),
  updateExpense: (id: number, data: ExpenseEdit) => api.patch<Expense>(`/bnb/expenses/${id}/`, data).then((r) => r.data),
  deleteExpense: (id: number) => api.delete(`/bnb/expenses/${id}/`),

  purchases: share(() => api.get<StockPurchase[]>('/bnb/stock-purchases/').then((r) => r.data)),
  registerPurchase: (data: StockPurchaseRegister) => api.post<StockPurchase>('/bnb/stock-purchases/', data).then((r) => r.data),
  updatePurchase: (id: number, data: StockPurchaseEdit) => api.patch<StockPurchase>(`/bnb/stock-purchases/${id}/`, data).then((r) => r.data),
  deletePurchase: (id: number) => api.delete(`/bnb/stock-purchases/${id}/`),

  /** `open: '1'` returns just the live session — the popups that only check
   *  the till gate skip the whole session history this way. */
  tills: share((params: { open?: '1'; limit?: number } = {}) =>
    api.get<TillSession[]>('/bnb/tills/', { params }).then((r) => r.data),
  ),
  /** Open the counter till with a starting float. */
  openTill: (data: TillOpen) => api.post<TillSession>('/bnb/tills/open/', data).then((r) => r.data),
  /** Close the till with each channel's counted total. */
  closeTill: (id: number, data: TillClose) => api.post<TillSession>(`/bnb/tills/${id}/close/`, data).then((r) => r.data),
  /** Register cash drawn from an open till. */
  registerDrawing: (id: number, data: TillDrawingRegister) =>
    api.post<TillDrawing>(`/bnb/tills/${id}/drawings/`, data).then((r) => r.data),
  /** Register a batch of drawings — one entry per channel, saved atomically. */
  registerDrawings: (id: number, data: TillDrawingRegister[]) =>
    api.post<TillDrawing[]>(`/bnb/tills/${id}/drawings/`, data).then((r) => r.data),
}

export const BNB_PAGE_SLUGS = ['']
