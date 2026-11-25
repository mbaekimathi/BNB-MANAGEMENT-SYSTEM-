import { useId } from 'react'
import { Input } from '../../components/hr/ui'
import type { Supplier } from '../../lib/bnb'
import type { WorkspaceTheme } from '../../lib/workspaces'

/** Supplier name + phone with autocomplete — picking an existing name fills
 *  the phone; a new name is registered into the system on save (the backend
 *  upserts suppliers by branch + name). */
export function SupplierFields({ t, suppliers, name, phone, onName, onPhone, nameError, phoneError, autoFocus = true }: {
  t: WorkspaceTheme
  suppliers: Supplier[]
  name: string
  phone: string
  onName: (value: string) => void
  onPhone: (value: string) => void
  nameError?: string
  phoneError?: string
  autoFocus?: boolean
}) {
  const listId = useId()
  return (
    <>
      <div>
        <Input t={t} label="Supplier name" list={listId} required autoFocus={autoFocus}
          placeholder="e.g. Naivas wholesalers"
          value={name}
          onChange={(e) => {
            const value = e.target.value
            onName(value)
            const match = suppliers.find((s) => s.name.toLowerCase() === value.trim().toLowerCase())
            if (match?.phone) onPhone(match.phone)
          }}
          error={nameError} />
        <datalist id={listId}>
          {suppliers.map((s) => (
            <option key={s.id} value={s.name}>{s.phone || undefined}</option>
          ))}
        </datalist>
      </div>
      <Input t={t} label="Supplier phone number" placeholder="e.g. 0712 345 678"
        value={phone} onChange={(e) => onPhone(e.target.value)} error={phoneError} />
    </>
  )
}
