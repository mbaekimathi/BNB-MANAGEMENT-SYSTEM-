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

export const rolePath = (role: Role) => `/${ROLE_SLUGS[role]}`

export const roleFromSlug = (slug: string | undefined) =>
  (Object.keys(ROLE_SLUGS) as Role[]).find((r) => ROLE_SLUGS[r] === slug)
