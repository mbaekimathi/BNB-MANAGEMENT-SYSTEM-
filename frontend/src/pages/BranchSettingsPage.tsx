import { Building2, Camera, Clock, CreditCard, Hash, KeyRound, MessageSquare, Palette, Trash2, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PhoneInput } from '../components/hr/PhoneInput'
import { Button, ErrorNote, Flash, Input, Loading, PageHeader, Panel, Pill, Select, Textarea } from '../components/hr/ui'
import { useAuth } from '../context/AuthContext'
import { parseApiError, type FieldErrors, type Role } from '../lib/api'
import { bnb, type BranchProfile, type BranchProfileEdit, type MessageChannel, type MessageDraft } from '../lib/bnb'
import { useApi } from '../lib/hr'
import { shrinkPhoto } from '../lib/image'
import { BRANCH_ROLES, ROLE_LABELS } from '../lib/roles'
import { THEME_NAMES, THEMES, WORKSPACES, type NavItem, type WorkspaceTheme } from '../lib/workspaces'

type T = { t: WorkspaceTheme }

/** Branch settings split into five pages — company details, theme, payments,
 *  communications and branch time. The sidebar child picks which panel shows. */
export default function BranchSettingsPage({ item, t }: { item: NavItem; t: WorkspaceTheme }) {
  const { data, error, loading, setData } = useApi(bnb.myBranch)

  return (
    <div className="space-y-6">
      <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} />
      {loading ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : error || !data ? (
        <Panel t={t}><ErrorNote t={t} message={error || 'No branch profile found.'} /></Panel>
      ) : item.slug === 'theme' ? (
        <ThemePanel t={t} profile={data} onSaved={setData} />
      ) : item.slug === 'payments' ? (
        <PaymentsPanel t={t} profile={data} onSaved={setData} />
      ) : item.slug === 'communications' ? (
        <CommsPanel t={t} profile={data} onSaved={setData} />
      ) : item.slug === 'time' ? (
        <TimePanel t={t} profile={data} onSaved={setData} />
      ) : (
        <DetailsPanel t={t} profile={data} onSaved={setData} />
      )}
    </div>
  )
}

function usePanelSave(onSaved: (p: BranchProfile) => void, doneText: string) {
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [flash, setFlash] = useState({ text: '', bad: false })

  const save = async (changes: BranchProfileEdit, photo?: File | null) => {
    setSaving(true)
    setErrors({})
    setFlash({ text: '', bad: false })
    try {
      onSaved(await bnb.updateMyBranch(changes, photo))
      setFlash({ text: doneText, bad: false })
      return true
    } catch (err) {
      const { message, fields } = parseApiError(err)
      setErrors(fields)
      setFlash({ text: message, bad: true })
      return false
    } finally {
      setSaving(false)
    }
  }

  return { saving, errors, flash, save, setFlash }
}

/** Branch contact details + picture; code and status are read-only. */
function DetailsPanel({ t, profile, onSaved }: T & { profile: BranchProfile; onSaved: (p: BranchProfile) => void }) {
  const p = usePanelSave(onSaved, 'Company details saved.')
  const [form, setForm] = useState({ name: profile.name, phone: profile.phone, email: profile.email, location: profile.location })
  const [photo, setPhoto] = useState<File | null | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : photo === null ? null : profile.photo), [photo, profile.photo])

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function pickPhoto(f: File | undefined) {
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
      return p.setFlash({ text: 'Use a JPG, PNG or WebP picture.', bad: true })
    try {
      setPhoto(await shrinkPhoto(f))
    } catch {
      p.setFlash({ text: "This picture couldn't be read. Try another one.", bad: true })
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const changes: BranchProfileEdit = {}
    for (const k of ['name', 'phone', 'email', 'location'] as const) if (form[k] !== profile[k]) changes[k] = form[k]
    if (!Object.keys(changes).length && photo === undefined) return p.setFlash({ text: 'Nothing changed.', bad: false })
    if (await p.save(changes, photo)) setPhoto(undefined)
  }

  return (
    <Panel t={t} className="relative overflow-hidden">
      <form onSubmit={submit} className="space-y-5">
        <SectionTitle t={t} icon={Building2} title="Company details" text="What guests and staff see for this branch." />
        <section className="flex items-center gap-4">
          <span className={`relative grid size-20 shrink-0 place-items-center overflow-hidden ring-2 ${t.radius} ${t.ring} ${t.iconBox}`}>
            {preview ? <img src={preview} alt={profile.name} className="size-full object-cover" /> : <Building2 className="size-7" />}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button t={t} variant="ghost" onClick={() => fileRef.current?.click()}><Camera className="size-3.5" />{preview ? 'Change picture' : 'Add picture'}</Button>
            {preview && <Button t={t} variant="danger" onClick={() => setPhoto(null)}><Trash2 className="size-3.5" />Remove</Button>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input t={t} label="Branch name" value={form.name} onChange={set('name')} error={p.errors.name} required />
          <PhoneInput t={t} label="Branch phone number" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} error={p.errors.phone} required />
          <Input t={t} label="Branch email" type="email" value={form.email} onChange={set('email')} error={p.errors.email} required />
          <Input t={t} label="Branch location" value={form.location} onChange={set('location')} error={p.errors.location} required />
        </div>
        <div className={`flex flex-wrap items-center gap-2 text-[11px] ${t.muted}`}>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${t.chip}`}><Hash className="size-3" /> Sign-in code {profile.code}</span>
          <Pill tone={profile.status === 'active' ? 'green' : 'red'}>{profile.status_label}</Pill>
          <span>Code and status are managed by Admin or IT Support.</span>
        </div>
        <SaveBar t={t} saving={p.saving} flash={p.flash} label="Save details" />
      </form>
    </Panel>
  )
}

/** Workspace theme per staff role — applies next time each role's app loads. */
function ThemePanel({ t, profile, onSaved }: T & { profile: BranchProfile; onSaved: (p: BranchProfile) => void }) {
  const p = usePanelSave(onSaved, 'Theme choices saved.')
  const { reload } = useAuth()
  const pick = (role: Role) => profile.role_themes[role] ?? WORKSPACES[role].theme.name
  const [form, setForm] = useState<Partial<Record<Role, string>>>(() =>
    Object.fromEntries(BRANCH_ROLES.map((role) => [role, pick(role)])),
  )

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!BRANCH_ROLES.some((role) => form[role] !== pick(role))) return p.setFlash({ text: 'Nothing changed.', bad: false })
    if (await p.save({ role_themes: form })) void reload()
  }

  return (
    <Panel t={t}>
      <form onSubmit={submit} className="space-y-5">
        <SectionTitle t={t} icon={Palette} title="Company theme" text="The workspace look each staff role at this branch signs in to." />
        <div className="space-y-3">
          {BRANCH_ROLES.map((role) => {
            const name = form[role] ?? pick(role)
            const sel = THEMES[name] ?? WORKSPACES[role].theme
            return (
              <div key={role} className={`flex flex-wrap items-center gap-3 p-3 ${t.radius} ${t.chip}`}>
                <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${sel.brandMark}`}>
                  <Palette className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                  <p className={`text-[11px] ${t.muted}`}>{name}</p>
                </div>
                <div className="w-full sm:w-56">
                  <Select t={t} value={name} onChange={(e) => setForm((f) => ({ ...f, [role]: e.target.value }))} aria-label={`Theme for ${ROLE_LABELS[role]}`}>
                    {THEME_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </div>
              </div>
            )
          })}
        </div>
        <p className={`text-[11px] ${t.muted}`}>Applies to each role's workspace the next time their app loads.</p>
        <SaveBar t={t} saving={p.saving} flash={p.flash} label="Save themes" />
      </form>
    </Panel>
  )
}

/** The ways guests can pay — each method toggles on, with the details to pay to
 *  and the API keys used to bill through that provider. */
function PaymentsPanel({ t, profile, onSaved }: T & { profile: BranchProfile; onSaved: (p: BranchProfile) => void }) {
  const p = usePanelSave(onSaved, 'Payment settings saved.')
  const [form, setForm] = useState({
    mpesa_enabled: profile.mpesa_enabled, mpesa_till: profile.mpesa_till, mpesa_account: profile.mpesa_account,
    mpesa_consumer_key: profile.mpesa_consumer_key, mpesa_consumer_secret: profile.mpesa_consumer_secret, mpesa_passkey: profile.mpesa_passkey,
    cash_enabled: profile.cash_enabled,
    card_enabled: profile.card_enabled, card_api_key: profile.card_api_key, card_api_secret: profile.card_api_secret,
    bank_enabled: profile.bank_enabled, bank_name: profile.bank_name,
    bank_account_name: profile.bank_account_name, bank_account_number: profile.bank_account_number,
  })
  const on = (k: keyof typeof form) => (v: boolean) => setForm((f) => ({ ...f, [k]: v }))
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const keyProps = { type: 'password', autoComplete: 'off' } as const

  async function submit(e: FormEvent) {
    e.preventDefault()
    const changes: BranchProfileEdit = {}
    for (const k of Object.keys(form) as (keyof typeof form)[]) if (form[k] !== profile[k]) (changes as Record<string, unknown>)[k] = form[k]
    if (!Object.keys(changes).length) return p.setFlash({ text: 'Nothing changed.', bad: false })
    await p.save(changes)
  }

  return (
    <Panel t={t}>
      <form onSubmit={submit} className="space-y-5">
        <SectionTitle t={t} icon={CreditCard} title="Branch payments" text="Which payment methods the front desk accepts, where the money goes and the API keys that bill them." />
        <div className="space-y-4">
          <Toggle t={t} on={form.mpesa_enabled} onChange={on('mpesa_enabled')} label="M-Pesa" hint="Till or paybill mobile payments." />
          {form.mpesa_enabled && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input t={t} label="Till / paybill number" value={form.mpesa_till} onChange={set('mpesa_till')} error={p.errors.mpesa_till} placeholder="e.g. 516600" />
                <Input t={t} label="Paybill account reference" value={form.mpesa_account} onChange={set('mpesa_account')} error={p.errors.mpesa_account} placeholder="Optional" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input t={t} label="Consumer key" value={form.mpesa_consumer_key} onChange={set('mpesa_consumer_key')} error={p.errors.mpesa_consumer_key} {...keyProps} />
                <Input t={t} label="Consumer secret" value={form.mpesa_consumer_secret} onChange={set('mpesa_consumer_secret')} error={p.errors.mpesa_consumer_secret} {...keyProps} />
                <Input t={t} label="Passkey" value={form.mpesa_passkey} onChange={set('mpesa_passkey')} error={p.errors.mpesa_passkey} {...keyProps} />
              </div>
            </>
          )}
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Toggle t={t} on={form.cash_enabled} onChange={on('cash_enabled')} label="Cash" hint="Walk-in cash payments." />
            <Toggle t={t} on={form.card_enabled} onChange={on('card_enabled')} label="Card (Visa)" hint="POS or online card payments." />
          </div>
          {form.card_enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input t={t} label="Card processor API key" value={form.card_api_key} onChange={set('card_api_key')} error={p.errors.card_api_key} {...keyProps} />
              <Input t={t} label="Card processor API secret" value={form.card_api_secret} onChange={set('card_api_secret')} error={p.errors.card_api_secret} {...keyProps} />
            </div>
          )}
        </div>
        <div className="space-y-4">
          <Toggle t={t} on={form.bank_enabled} onChange={on('bank_enabled')} label="Bank transfer" hint="Direct deposits to the branch account." />
          {form.bank_enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input t={t} label="Bank name" value={form.bank_name} onChange={set('bank_name')} error={p.errors.bank_name} placeholder="e.g. KCB" />
              <Input t={t} label="Account name" value={form.bank_account_name} onChange={set('bank_account_name')} error={p.errors.bank_account_name} />
              <Input t={t} label="Account number" value={form.bank_account_number} onChange={set('bank_account_number')} error={p.errors.bank_account_number} />
            </div>
          )}
        </div>
        <SaveBar t={t} saving={p.saving} flash={p.flash} label="Save payments" />
      </form>
    </Panel>
  )
}

/** The guest-message triggers a draft can hang off. */
const TRIGGERS: { key: string; label: string; hint: string }[] = [
  { key: 'booking_confirmed', label: 'Booking confirmed', hint: 'Sent when a reservation is booked.' },
  { key: 'arrival_reminder', label: 'Arrival reminder', hint: 'Sent shortly before the guest arrives.' },
  { key: 'checked_in', label: 'Guest checked in', hint: 'Sent when the guest takes the room.' },
  { key: 'checked_out', label: 'Guest checked out', hint: 'Sent after the guest leaves.' },
  { key: 'payment_received', label: 'Payment received', hint: 'Sent when a payment is recorded.' },
]

const CHANNELS: { value: MessageChannel; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const BLANK_DRAFT: MessageDraft = { enabled: true, channel: 'email', subject: '', body: '' }

/** Guest messaging — channel toggles plus each channel's API keys, and a drafted
 *  message per trigger. Two panels, each saving only its own fields. */
function CommsPanel({ t, profile, onSaved }: T & { profile: BranchProfile; onSaved: (p: BranchProfile) => void }) {
  return (
    <>
      <ChannelsPanel t={t} profile={profile} onSaved={onSaved} />
      <DraftsPanel t={t} profile={profile} onSaved={onSaved} />
    </>
  )
}

function ChannelsPanel({ t, profile, onSaved }: T & { profile: BranchProfile; onSaved: (p: BranchProfile) => void }) {
  const p = usePanelSave(onSaved, 'Communication settings saved.')
  const [form, setForm] = useState({
    email_enabled: profile.email_enabled, email_api_key: profile.email_api_key,
    sms_enabled: profile.sms_enabled, sms_sender_id: profile.sms_sender_id,
    sms_api_username: profile.sms_api_username, sms_api_key: profile.sms_api_key,
    whatsapp_enabled: profile.whatsapp_enabled, whatsapp_number: profile.whatsapp_number, whatsapp_api_key: profile.whatsapp_api_key,
  })
  const on = (k: keyof typeof form) => (v: boolean) => setForm((f) => ({ ...f, [k]: v }))
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const keyProps = { type: 'password', autoComplete: 'off' } as const

  async function submit(e: FormEvent) {
    e.preventDefault()
    const changes: BranchProfileEdit = {}
    for (const k of Object.keys(form) as (keyof typeof form)[]) if (form[k] !== profile[k]) (changes as Record<string, unknown>)[k] = form[k]
    if (!Object.keys(changes).length) return p.setFlash({ text: 'Nothing changed.', bad: false })
    await p.save(changes)
  }

  return (
    <Panel t={t}>
      <form onSubmit={submit} className="space-y-5">
        <SectionTitle t={t} icon={KeyRound} title="Channels & API keys" text="How booking and guest messages reach your clients." />
        <div className="space-y-4">
          <Toggle t={t} on={form.email_enabled} onChange={on('email_enabled')} label="Email" hint={`Guest emails are sent from ${profile.email || 'the branch email'}.`} />
          {form.email_enabled && (
            <Input t={t} label="Email service API key" value={form.email_api_key} onChange={set('email_api_key')} error={p.errors.email_api_key} {...keyProps} />
          )}
        </div>
        <div className="space-y-4">
          <Toggle t={t} on={form.sms_enabled} onChange={on('sms_enabled')} label="SMS" hint="Text messages for confirmations and reminders." />
          {form.sms_enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input t={t} label="Sender name (max 11 chars)" value={form.sms_sender_id} onChange={set('sms_sender_id')} error={p.errors.sms_sender_id} maxLength={11} placeholder="e.g. WESTHOUSE" />
              <Input t={t} label="SMS provider username" value={form.sms_api_username} onChange={set('sms_api_username')} error={p.errors.sms_api_username} placeholder="e.g. sandbox" />
              <div className="sm:col-span-2">
                <Input t={t} label="SMS provider API key" value={form.sms_api_key} onChange={set('sms_api_key')} error={p.errors.sms_api_key} {...keyProps} />
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <Toggle t={t} on={form.whatsapp_enabled} onChange={on('whatsapp_enabled')} label="WhatsApp" hint="Chat guests on the branch WhatsApp line." />
          {form.whatsapp_enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <PhoneInput t={t} label="WhatsApp number" value={form.whatsapp_number} onChange={(v) => setForm((f) => ({ ...f, whatsapp_number: v }))} error={p.errors.whatsapp_number} />
              <Input t={t} label="WhatsApp API key" value={form.whatsapp_api_key} onChange={set('whatsapp_api_key')} error={p.errors.whatsapp_api_key} {...keyProps} />
            </div>
          )}
        </div>
        <SaveBar t={t} saving={p.saving} flash={p.flash} label="Save channels" />
      </form>
    </Panel>
  )
}

function DraftsPanel({ t, profile, onSaved }: T & { profile: BranchProfile; onSaved: (p: BranchProfile) => void }) {
  const p = usePanelSave(onSaved, 'Message drafts saved.')
  const [form, setForm] = useState<Record<string, MessageDraft>>(() =>
    Object.fromEntries(TRIGGERS.map(({ key }) => [key, { ...BLANK_DRAFT, ...(profile.message_templates[key] ?? {}) }])),
  )
  const patch = (key: string, changes: Partial<MessageDraft>) => setForm((f) => ({ ...f, [key]: { ...f[key], ...changes } }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (JSON.stringify(form) === JSON.stringify(Object.fromEntries(TRIGGERS.map(({ key }) => [key, { ...BLANK_DRAFT, ...(profile.message_templates[key] ?? {}) }]))))
      return p.setFlash({ text: 'Nothing changed.', bad: false })
    await p.save({ message_templates: form })
  }

  return (
    <Panel t={t}>
      <form onSubmit={submit} className="space-y-5">
        <SectionTitle t={t} icon={MessageSquare} title="Guest message drafts" text="The message sent for each trigger, and the channel it goes out on." />
        <div className="space-y-4">
          {TRIGGERS.map(({ key, label, hint }) => {
            const d = form[key]
            return (
              <section key={key} className={`space-y-3 p-3 ${t.radius} ${t.chip}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Toggle t={t} on={d.enabled} onChange={(v) => patch(key, { enabled: v })} label={label} hint={hint} />
                  </div>
                  <div className="w-full sm:w-40">
                    <Select
                      t={t} value={d.channel} aria-label={`${label} channel`} disabled={!d.enabled}
                      onChange={(e) => patch(key, { channel: e.target.value as MessageChannel })}
                    >
                      {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </Select>
                  </div>
                </div>
                {d.enabled && (
                  <>
                    {d.channel === 'email' && (
                      <Input
                        t={t} label="Subject" value={d.subject} placeholder={`e.g. Your booking at ${profile.name}`}
                        onChange={(e) => patch(key, { subject: e.target.value })}
                      />
                    )}
                    <Textarea
                      t={t} label="Message" value={d.body} rows={3}
                      placeholder={`Hi {guest_name}, ${hint === 'Sent when a payment is recorded.' ? 'we have received your payment of {amount}' : 'your stay at ' + profile.name + ' is confirmed'}.`}
                      onChange={(e) => patch(key, { body: e.target.value })}
                    />
                  </>
                )}
              </section>
            )
          })}
        </div>
        <p className={`text-[11px] ${t.muted}`}>
          Placeholders: {'{guest_name}'} {'{branch_name}'} {'{room}'} {'{start_date}'} {'{end_date}'} {'{amount}'}
        </p>
        <SaveBar t={t} saving={p.saving} flash={p.flash} label="Save drafts" />
      </form>
    </Panel>
  )
}

/** Branch hours and the guest check-in / check-out window. */
function TimePanel({ t, profile, onSaved }: T & { profile: BranchProfile; onSaved: (p: BranchProfile) => void }) {
  const p = usePanelSave(onSaved, 'Branch times saved.')
  const toHM = (v: string | null) => (v ?? '').slice(0, 5)
  const [form, setForm] = useState({
    opens_at: toHM(profile.opens_at), closes_at: toHM(profile.closes_at),
    checkin_from: toHM(profile.checkin_from), checkout_by: toHM(profile.checkout_by),
  })
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const changes: BranchProfileEdit = {}
    for (const k of Object.keys(form) as (keyof typeof form)[]) if (form[k] !== toHM(profile[k])) changes[k] = form[k] || null
    if (!Object.keys(changes).length) return p.setFlash({ text: 'Nothing changed.', bad: false })
    await p.save(changes)
  }

  return (
    <Panel t={t}>
      <form onSubmit={submit} className="space-y-5">
        <SectionTitle t={t} icon={Clock} title="Branch time" text="When the branch opens and the window guests can check in and out." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input t={t} label="Opening time" type="time" value={form.opens_at} onChange={set('opens_at')} error={p.errors.opens_at} />
          <Input t={t} label="Closing time" type="time" value={form.closes_at} onChange={set('closes_at')} error={p.errors.closes_at} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input t={t} label="Guest check-in from" type="time" value={form.checkin_from} onChange={set('checkin_from')} error={p.errors.checkin_from} />
          <Input t={t} label="Guest check-out by" type="time" value={form.checkout_by} onChange={set('checkout_by')} error={p.errors.checkout_by} />
        </div>
        <SaveBar t={t} saving={p.saving} flash={p.flash} label="Save times" />
      </form>
    </Panel>
  )
}

function SectionTitle({ t, icon: Icon, title, text }: T & { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <h3 className={`text-sm ${t.heading}`}>{title}</h3>
        <p className={`text-[11px] ${t.muted}`}>{text}</p>
      </div>
    </div>
  )
}

function Toggle({ t, on, onChange, label, hint }: T & { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-3 text-left">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? t.brandMark : `${t.chip} bg-slate-300/40 dark:bg-white/10`}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className={`block truncate text-[11px] ${t.muted}`}>{hint}</span>}
      </span>
    </button>
  )
}

function SaveBar({ t, saving, flash, label }: T & { saving: boolean; flash: { text: string; bad: boolean }; label: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <span className="flex-1"><Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} /></span>
      <Button t={t} type="submit" busy={saving}>{saving ? 'Saving…' : label}</Button>
    </div>
  )
}
