import { api } from './api'

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

export type RoomStatus = 'active' | 'maintenance' | 'suspended'
export type RoomType = 'single' | 'double' | 'twin' | 'queen' | 'king' | 'suite' | 'family'

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

export type BookingKind = 'reservation' | 'stay'
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
}

export type PaymentMethod = 'mpesa' | 'cash' | 'visa' | 'bank' | 'other'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cash', label: 'Cash' },
  { value: 'visa', label: 'Visa' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

/** Money received for a booking — `companion` null means the main guest paid. */
export interface BookingPayment {
  id: number
  companion: number | null
  payer: string
  amount: string
  method: PaymentMethod
  method_label: string
  reference: string
  created_at: string
}

export interface BookingPaymentRegister {
  /** Party position: 0 = main guest, n = the nth extra guest. */
  guest: number
  amount: number
  method: PaymentMethod
  reference?: string
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
  kind: BookingKind
  kind_label: string
  status: BookingStatus
  status_label: string
  start: string
  end: string
  nights: number
  deposit: string | null
  created_by_name: string | null
  created_at: string
}

export interface BookingRegister {
  room: number
  guest_name: string
  guest_phone: string
  guest_email?: string
  guest_id_type?: GuestIdType | ''
  guest_id_number?: string
  guest_nationality?: string
  guest_notes?: string
  companions?: Omit<BookingGuest, 'id' | 'id_type_label' | 'room_name'>[]
  payments?: BookingPaymentRegister[]
  guests: number
  kind: BookingKind
  start: string
  end: string
  deposit?: number | null
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
  { value: 'suite', label: 'Suite' },
  { value: 'family', label: 'Family' },
]

export const bnb = {
  branches: () => api.get<Branch[]>('/bnb/branches/').then((r) => r.data),
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

  rooms: () => api.get<Room[]>('/bnb/rooms/').then((r) => r.data),
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

  bookings: () => api.get<Booking[]>('/bnb/bookings/').then((r) => r.data),
  registerBooking: (data: BookingRegister) => api.post<Booking>('/bnb/bookings/', data).then((r) => r.data),
  checkinBooking: (id: number) => api.post<Booking>(`/bnb/bookings/${id}/checkin/`).then((r) => r.data),
  checkoutBooking: (id: number) => api.post<Booking>(`/bnb/bookings/${id}/checkout/`).then((r) => r.data),
  cancelBooking: (id: number) => api.post<Booking>(`/bnb/bookings/${id}/cancel/`).then((r) => r.data),
}

export const BNB_PAGE_SLUGS = ['']
