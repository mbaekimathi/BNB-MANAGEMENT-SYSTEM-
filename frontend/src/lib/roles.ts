import type { Role } from './api'

export const ROLE_SLUGS: Record<Role, string> = {
  admin: 'admin',
  company_manager: 'company-manager',
  it_support: 'it-support',
  company_store_manager: 'company-store-manager',
  branch_store_manager: 'branch-store-manager',
  branch_manager: 'branch-manager',
  branch_receptionist: 'branch-receptionist',
  branch_employee: 'branch-employee',
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  company_manager: 'Company Manager',
  it_support: 'IT Support',
  company_store_manager: 'Company Store Manager',
  branch_store_manager: 'Branch Store Manager',
  branch_manager: 'Branch Manager',
  branch_receptionist: 'Branch Receptionist',
  branch_employee: 'Branch Employee',
}

/** Roles that work at a single BnB branch (rather than company-wide). */
export const BRANCH_ROLES: Role[] = ['branch_manager', 'branch_receptionist', 'branch_store_manager', 'branch_employee']

export const isBranchRole = (role: Role) => BRANCH_ROLES.includes(role)

export const rolePath = (role: Role) => `/${ROLE_SLUGS[role]}`

/** Base URL of the role's client list/portal section. The manager reaches it
 *  through "Guest history"; the receptionist through "Clients". */
export const clientPath = (role: Role) =>
  `${rolePath(role)}/${role === 'branch_manager' ? 'guest-history' : 'clients'}`

export const roleFromSlug = (slug: string | undefined) =>
  (Object.keys(ROLE_SLUGS) as Role[]).find((r) => ROLE_SLUGS[r] === slug)
