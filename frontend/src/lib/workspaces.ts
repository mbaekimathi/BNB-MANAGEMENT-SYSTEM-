import {
  Activity,
  BarChart3,
  BedDouble,
  Boxes,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  ConciergeBell,
  CreditCard,
  FileBarChart,
  HardDrive,
  Headset,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  PackageCheck,
  PackageSearch,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCircle,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from './api'

export interface NavItem {
  slug: string
  label: string
  short?: string
  icon: LucideIcon
  description: string
}

/** Tailwind classes that give each role workspace its own look. */
export interface WorkspaceTheme {
  name: string
  mode: 'dark' | 'light'
  root: string
  glowA: string
  glowB: string
  pattern?: string
  radius: string
  heading: string
  muted: string
  accentText: string
  // sidebar
  sidebar: string
  sidebarFrame: string
  contentOffset: string
  brandMark: string
  brandText: string
  brandSub: string
  navIdle: string
  navActive: string
  sidebarMuted: string
  sidebarDivider: string
  // header / footer
  header: string
  iconButton: string
  footer: string
  bottomNav: string
  bottomActive: string
  bottomIdle: string
  // content
  card: string
  cardHover: string
  iconBox: string
  badge: string
  chip: string
  ring: string
}

export interface Workspace {
  theme: WorkspaceTheme
  nav: NavItem[]
}

const overview = (description: string): NavItem => ({
  slug: '',
  label: 'Overview',
  icon: LayoutDashboard,
  description,
})

export const WORKSPACES: Record<Role, Workspace> = {
  admin: {
    theme: {
      name: 'Obsidian',
      mode: 'dark',
      root: 'bg-[#0a0a0d] text-zinc-100',
      glowA: 'bg-[radial-gradient(circle,rgba(244,63,94,0.16),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(190,18,60,0.10),transparent_60%)]',
      radius: 'rounded-xl',
      heading: 'font-sans font-semibold tracking-tight text-white',
      muted: 'text-zinc-400',
      accentText: 'text-rose-400',
      sidebar: 'border-r border-white/[0.06] bg-[#0f0f13]',
      sidebarFrame: 'md:inset-y-0 md:left-0',
      contentOffset: 'md:pl-20 lg:pl-64',
      brandMark: 'bg-gradient-to-br from-rose-500 to-red-700 text-white shadow-lg shadow-rose-600/30',
      brandText: 'text-white',
      brandSub: 'text-rose-400/80',
      navIdle: 'text-zinc-400 hover:bg-white/[0.04] hover:text-white',
      navActive:
        'bg-rose-500/10 text-white before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-rose-500',
      sidebarMuted: 'text-zinc-500',
      sidebarDivider: 'border-white/[0.06]',
      header: 'border-b border-white/[0.06] bg-[#0a0a0d]/80 backdrop-blur-xl',
      iconButton: 'text-zinc-400 hover:bg-white/[0.06] hover:text-white',
      footer: 'border-t border-white/[0.06] text-zinc-500',
      bottomNav: 'border-t border-white/[0.06] bg-[#0f0f13]/95 backdrop-blur-xl',
      bottomActive: 'text-rose-400',
      bottomIdle: 'text-zinc-500',
      card: 'border border-white/[0.06] bg-[#111116]',
      cardHover: 'hover:border-rose-500/40 hover:bg-[#15151b]',
      iconBox: 'bg-rose-500/10 text-rose-400',
      badge: 'border border-rose-500/30 bg-rose-500/10 text-rose-300',
      chip: 'border border-white/[0.08] text-zinc-300',
      ring: 'ring-rose-500/60',
    },
    nav: [
      overview('Company-wide control centre.'),
      { slug: 'employees', label: 'Employees', icon: Users, description: 'Activate, suspend and manage every staff account.' },
      { slug: 'branches', label: 'Branches', icon: Building2, description: 'Add branches and assign their managers.' },
      { slug: 'access', label: 'Roles & access', short: 'Access', icon: ShieldCheck, description: 'Decide what each role can see and do.' },
      { slug: 'reports', label: 'Reports', icon: FileBarChart, description: 'Bookings, revenue and stock across the company.' },
      { slug: 'settings', label: 'Settings', icon: Settings, description: 'Company details, taxes and system preferences.' },
    ],
  },

  company_manager: {
    theme: {
      name: 'Royal Gold',
      mode: 'dark',
      root: 'bg-ink-950 text-slate-100',
      glowA: 'bg-[radial-gradient(circle,rgba(233,185,100,0.20),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(56,97,251,0.20),transparent_60%)]',
      radius: 'rounded-2xl',
      heading: 'font-display font-medium text-white',
      muted: 'text-slate-400',
      accentText: 'text-gold-300',
      sidebar: 'border-r border-white/10 bg-white/[0.03] backdrop-blur-2xl',
      sidebarFrame: 'md:inset-y-0 md:left-0',
      contentOffset: 'md:pl-20 lg:pl-64',
      brandMark: 'bg-gradient-to-br from-gold-300 to-gold-500 text-ink-950 shadow-lg shadow-gold-500/30',
      brandText: 'font-display text-white',
      brandSub: 'text-gold-300/80',
      navIdle: 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
      navActive: 'bg-gradient-to-r from-gold-300/20 to-transparent text-gold-200 ring-1 ring-inset ring-gold-300/25',
      sidebarMuted: 'text-slate-500',
      sidebarDivider: 'border-white/10',
      header: 'mx-3 mt-3 rounded-2xl border border-white/10 bg-ink-900/70 shadow-xl shadow-black/30 backdrop-blur-xl',
      iconButton: 'text-slate-300 hover:bg-white/[0.07] hover:text-white',
      footer: 'mx-3 mb-3 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-400',
      bottomNav: 'border-t border-white/10 bg-ink-900/90 backdrop-blur-xl',
      bottomActive: 'text-gold-300',
      bottomIdle: 'text-slate-500',
      card: 'border border-white/10 bg-white/[0.04] backdrop-blur-xl',
      cardHover: 'hover:border-gold-300/40 hover:bg-white/[0.06]',
      iconBox: 'bg-gold-300/10 text-gold-300',
      badge: 'border border-gold-300/30 bg-gold-300/10 text-gold-200',
      chip: 'border border-white/10 text-slate-300',
      ring: 'ring-gold-300/60',
    },
    nav: [
      overview('How every branch is performing today.'),
      { slug: 'branches', label: 'Branches', icon: Building2, description: 'Compare branches side by side.' },
      { slug: 'revenue', label: 'Revenue', icon: BarChart3, description: 'Daily, monthly and yearly income.' },
      { slug: 'occupancy', label: 'Occupancy', icon: BedDouble, description: 'Room occupancy and booking trends.' },
      { slug: 'staff', label: 'Staff', icon: Users, description: 'Branch teams and their managers.' },
      { slug: 'reports', label: 'Reports', icon: FileBarChart, description: 'Export reports for the board.' },
    ],
  },

  it_support: {
    theme: {
      name: 'Terminal',
      mode: 'dark',
      root: 'bg-[#04080b] text-slate-200',
      glowA: 'bg-[radial-gradient(circle,rgba(34,211,238,0.14),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(16,185,129,0.08),transparent_60%)]',
      pattern: 'grid-pattern [mask-image:linear-gradient(to_bottom,black,transparent_80%)]',
      radius: 'rounded-md',
      heading: 'font-mono font-semibold uppercase tracking-wider text-cyan-50',
      muted: 'text-slate-400',
      accentText: 'text-cyan-300',
      sidebar: 'border-r border-cyan-400/15 bg-[#060c10]',
      sidebarFrame: 'md:inset-y-0 md:left-0',
      contentOffset: 'md:pl-20 lg:pl-64',
      brandMark: 'bg-cyan-400 text-[#04080b] shadow-[0_0_24px_rgba(34,211,238,0.45)]',
      brandText: 'font-mono text-cyan-50',
      brandSub: 'font-mono text-cyan-400/70',
      navIdle: 'font-mono text-slate-400 hover:bg-cyan-400/[0.05] hover:text-cyan-200',
      navActive: 'bg-cyan-400/[0.08] font-mono text-cyan-300 ring-1 ring-inset ring-cyan-400/40',
      sidebarMuted: 'font-mono text-slate-500',
      sidebarDivider: 'border-cyan-400/15',
      header: 'border-b border-cyan-400/15 bg-[#04080b]/85 backdrop-blur',
      iconButton: 'text-cyan-200/70 hover:bg-cyan-400/10 hover:text-cyan-200',
      footer: 'border-t border-cyan-400/15 font-mono text-cyan-300/50',
      bottomNav: 'border-t border-cyan-400/20 bg-[#060c10]/95 backdrop-blur',
      bottomActive: 'text-cyan-300',
      bottomIdle: 'text-slate-500',
      card: 'border border-cyan-400/15 bg-[#071017]',
      cardHover: 'hover:border-cyan-400/50 hover:shadow-[0_0_24px_rgba(34,211,238,0.12)]',
      iconBox: 'bg-cyan-400/10 text-cyan-300',
      badge: 'border border-cyan-400/40 bg-cyan-400/10 font-mono text-cyan-200',
      chip: 'border border-cyan-400/15 font-mono text-slate-300',
      ring: 'ring-cyan-400/60',
    },
    nav: [
      overview('System status and open support work.'),
      { slug: 'accounts', label: 'User accounts', short: 'Accounts', icon: KeyRound, description: 'Reset passwords and unlock accounts.' },
      { slug: 'tickets', label: 'Support tickets', short: 'Tickets', icon: Headset, description: 'Requests raised by staff across branches.' },
      { slug: 'devices', label: 'Devices', icon: HardDrive, description: 'Computers, printers and tablets at each branch.' },
      { slug: 'health', label: 'System health', short: 'Health', icon: Activity, description: 'Server, database and backup status.' },
      { slug: 'logs', label: 'Activity logs', short: 'Logs', icon: ClipboardList, description: 'Who signed in and what changed.' },
    ],
  },

  company_store_manager: {
    theme: {
      name: 'Emerald Ledger',
      mode: 'dark',
      root: 'bg-[#05110d] text-emerald-50',
      glowA: 'bg-[radial-gradient(circle,rgba(16,185,129,0.18),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(163,230,53,0.08),transparent_60%)]',
      radius: 'rounded-2xl',
      heading: 'font-sans font-bold tracking-tight text-white',
      muted: 'text-emerald-100/55',
      accentText: 'text-emerald-300',
      sidebar: 'border border-emerald-400/15 bg-gradient-to-b from-emerald-900/70 to-[#071a13] shadow-2xl shadow-black/40',
      sidebarFrame: 'md:top-3 md:bottom-3 md:left-3 md:rounded-3xl',
      contentOffset: 'md:pl-[6.25rem] lg:pl-[17.75rem]',
      brandMark: 'bg-gradient-to-br from-emerald-300 to-lime-300 text-emerald-950 shadow-lg shadow-emerald-500/30',
      brandText: 'text-white',
      brandSub: 'text-emerald-300/80',
      navIdle: 'text-emerald-100/60 hover:bg-white/[0.06] hover:text-white',
      navActive: 'bg-emerald-400 font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30',
      sidebarMuted: 'text-emerald-100/45',
      sidebarDivider: 'border-emerald-400/15',
      header: 'bg-[#05110d]/70 backdrop-blur-md',
      iconButton: 'text-emerald-100/70 hover:bg-emerald-400/10 hover:text-white',
      footer: 'text-emerald-100/40',
      bottomNav: 'mx-3 mb-3 rounded-2xl border border-emerald-400/20 bg-[#0a2119]/95 shadow-2xl shadow-black/50 backdrop-blur-xl',
      bottomActive: 'text-emerald-300',
      bottomIdle: 'text-emerald-100/45',
      card: 'border border-emerald-400/10 bg-emerald-950/40',
      cardHover: 'hover:-translate-y-0.5 hover:border-emerald-400/40',
      iconBox: 'bg-emerald-400/15 text-emerald-300',
      badge: 'bg-emerald-400 font-semibold text-emerald-950',
      chip: 'border border-emerald-400/15 text-emerald-100/80',
      ring: 'ring-emerald-400/60',
    },
    nav: [
      overview('Central store and supply across all branches.'),
      { slug: 'central-store', label: 'Central store', short: 'Store', icon: Warehouse, description: 'Stock held at head office.' },
      { slug: 'suppliers', label: 'Suppliers', icon: Truck, description: 'Supplier contacts, prices and terms.' },
      { slug: 'purchase-orders', label: 'Purchase orders', short: 'Orders', icon: ShoppingCart, description: 'Order new stock and track deliveries.' },
      { slug: 'transfers', label: 'Branch transfers', short: 'Transfers', icon: PackageCheck, description: 'Send stock out to branches.' },
      { slug: 'reports', label: 'Stock reports', short: 'Reports', icon: FileBarChart, description: 'Usage, value and reorder levels.' },
    ],
  },

  branch_store_manager: {
    theme: {
      name: 'Amber Warehouse',
      mode: 'dark',
      root: 'bg-[#120e0a] text-stone-100',
      glowA: 'bg-[radial-gradient(circle,rgba(245,158,11,0.16),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(234,88,12,0.10),transparent_60%)]',
      radius: 'rounded-xl',
      heading: 'font-sans font-extrabold tracking-tight text-white',
      muted: 'text-stone-400',
      accentText: 'text-amber-400',
      sidebar: 'bg-gradient-to-b from-amber-500 via-orange-600 to-orange-800 text-white',
      sidebarFrame: 'md:inset-y-0 md:left-0',
      contentOffset: 'md:pl-20 lg:pl-64',
      brandMark: 'bg-white text-orange-600 shadow-lg shadow-orange-900/30',
      brandText: 'text-white',
      brandSub: 'text-white/70',
      navIdle: 'text-white/75 hover:bg-white/15 hover:text-white',
      navActive: 'bg-white font-semibold text-orange-700 shadow-lg shadow-orange-900/30',
      sidebarMuted: 'text-white/70',
      sidebarDivider: 'border-white/20',
      header: 'border-b border-amber-500/15 bg-[#120e0a]/85 backdrop-blur',
      iconButton: 'text-stone-300 hover:bg-amber-500/10 hover:text-amber-300',
      footer: 'border-t border-amber-500/10 text-stone-500',
      bottomNav: 'bg-gradient-to-r from-amber-500 to-orange-700',
      bottomActive: 'text-white',
      bottomIdle: 'text-white/60',
      card: 'border border-amber-500/10 bg-[#1a140e]',
      cardHover: 'hover:border-amber-400/50 hover:bg-[#21180f]',
      iconBox: 'bg-gradient-to-br from-amber-400 to-orange-600 text-white',
      badge: 'bg-amber-400/15 font-semibold text-amber-300',
      chip: 'border border-amber-500/15 text-stone-300',
      ring: 'ring-amber-400/70',
    },
    nav: [
      overview("This branch's store at a glance."),
      { slug: 'stock', label: 'Branch stock', short: 'Stock', icon: Boxes, description: 'Everything held in the branch store.' },
      { slug: 'requisitions', label: 'Requisitions', short: 'Requests', icon: ClipboardList, description: 'Request stock from the company store.' },
      { slug: 'deliveries', label: 'Deliveries', icon: Truck, description: 'Receive and confirm incoming stock.' },
      { slug: 'counts', label: 'Stock counts', short: 'Counts', icon: PackageSearch, description: 'Count stock and record differences.' },
      { slug: 'reports', label: 'Reports', icon: FileBarChart, description: 'Branch usage and reorder needs.' },
    ],
  },

  branch_manager: {
    theme: {
      name: 'Indigo Aurora',
      mode: 'dark',
      root: 'bg-[#0b0820] text-violet-50',
      glowA: 'bg-[radial-gradient(circle,rgba(139,92,246,0.28),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(217,70,239,0.18),transparent_60%)]',
      radius: 'rounded-2xl',
      heading: 'font-display font-semibold text-white',
      muted: 'text-violet-200/60',
      accentText: 'text-fuchsia-300',
      sidebar: 'border border-white/10 bg-white/[0.06] shadow-2xl shadow-violet-950/50 backdrop-blur-2xl',
      sidebarFrame: 'md:top-3 md:bottom-3 md:left-3 md:rounded-[1.75rem]',
      contentOffset: 'md:pl-[6.25rem] lg:pl-[17.75rem]',
      brandMark: 'bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/40',
      brandText: 'font-display text-white',
      brandSub: 'text-fuchsia-300/80',
      navIdle: 'text-violet-100/60 hover:bg-white/[0.08] hover:text-white',
      navActive: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30',
      sidebarMuted: 'text-violet-200/50',
      sidebarDivider: 'border-white/10',
      header: 'mx-3 mt-3 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl',
      iconButton: 'text-violet-100/70 hover:bg-white/10 hover:text-white',
      footer: 'text-violet-200/40',
      bottomNav: 'mx-3 mb-3 rounded-full border border-white/10 bg-[#1a1240]/90 shadow-2xl shadow-black/50 backdrop-blur-2xl',
      bottomActive: 'text-fuchsia-300',
      bottomIdle: 'text-violet-200/50',
      card: 'border border-white/10 bg-white/[0.05] backdrop-blur-xl',
      cardHover: 'hover:border-fuchsia-400/40 hover:bg-white/[0.08]',
      iconBox: 'bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-fuchsia-200',
      badge: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white',
      chip: 'border border-white/10 text-violet-100/80',
      ring: 'ring-fuchsia-400/60',
    },
    nav: [
      overview('Your branch today: guests, rooms and team.'),
      { slug: 'bookings', label: 'Bookings', icon: CalendarDays, description: 'All reservations for this branch.' },
      { slug: 'rooms', label: 'Rooms', icon: BedDouble, description: 'Room status, prices and maintenance.' },
      { slug: 'staff', label: 'Staff', icon: Users, description: 'Shifts and duties for your team.' },
      { slug: 'guests', label: 'Guests', icon: UserCircle, description: 'Guest history and feedback.' },
      { slug: 'reports', label: 'Reports', icon: FileBarChart, description: 'Branch income and occupancy.' },
    ],
  },

  branch_receptionist: {
    theme: {
      name: 'Coastal Light',
      mode: 'light',
      root: 'bg-[#f3f7fb] text-slate-700',
      glowA: 'bg-[radial-gradient(circle,rgba(14,165,233,0.14),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(20,184,166,0.10),transparent_60%)]',
      radius: 'rounded-2xl',
      heading: 'font-sans font-semibold tracking-tight text-slate-900',
      muted: 'text-slate-500',
      accentText: 'text-sky-600',
      sidebar: 'border-r border-slate-200/80 bg-white shadow-[4px_0_24px_rgba(15,23,42,0.04)]',
      sidebarFrame: 'md:inset-y-0 md:left-0',
      contentOffset: 'md:pl-20 lg:pl-64',
      brandMark: 'bg-gradient-to-br from-sky-400 to-teal-500 text-white shadow-lg shadow-sky-500/30',
      brandText: 'text-slate-900',
      brandSub: 'text-sky-600',
      navIdle: 'text-slate-500 hover:bg-sky-50 hover:text-sky-700',
      navActive: 'bg-sky-500 text-white shadow-md shadow-sky-500/30',
      sidebarMuted: 'text-slate-400',
      sidebarDivider: 'border-slate-200',
      header: 'border-b border-slate-200/80 bg-white/80 backdrop-blur-xl',
      iconButton: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
      footer: 'border-t border-slate-200 bg-white text-slate-400',
      bottomNav: 'border-t border-slate-200 bg-white/95 backdrop-blur-xl',
      bottomActive: 'text-sky-600',
      bottomIdle: 'text-slate-400',
      card: 'border border-slate-200/80 bg-white shadow-sm',
      cardHover: 'hover:border-sky-300 hover:shadow-lg hover:shadow-sky-500/10',
      iconBox: 'bg-sky-50 text-sky-600',
      badge: 'bg-sky-50 font-medium text-sky-700 ring-1 ring-inset ring-sky-200',
      chip: 'bg-slate-100 text-slate-600',
      ring: 'ring-sky-400/70',
    },
    nav: [
      overview("Today's arrivals, departures and guests in house."),
      { slug: 'check-in', label: 'Check-in / out', short: 'Check-in', icon: ConciergeBell, description: 'Welcome guests and close their stay.' },
      { slug: 'reservations', label: 'Reservations', short: 'Bookings', icon: CalendarCheck, description: 'Take and change bookings.' },
      { slug: 'guests', label: 'Guests', icon: Users, description: 'Guest details and special requests.' },
      { slug: 'rooms', label: 'Rooms', icon: BedDouble, description: 'Which rooms are free, booked or being cleaned.' },
      { slug: 'payments', label: 'Payments', icon: CreditCard, description: 'Receive payments and print receipts.' },
    ],
  },

  branch_employee: {
    theme: {
      name: 'Sunrise',
      mode: 'light',
      root: 'bg-[#fbf6f0] text-stone-700',
      glowA: 'bg-[radial-gradient(circle,rgba(251,146,60,0.16),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(45,212,191,0.12),transparent_60%)]',
      radius: 'rounded-3xl',
      heading: 'font-display font-semibold text-stone-900',
      muted: 'text-stone-500',
      accentText: 'text-orange-600',
      sidebar: 'bg-[#1f3b3a] text-teal-50 md:rounded-r-[2rem]',
      sidebarFrame: 'md:inset-y-0 md:left-0',
      contentOffset: 'md:pl-20 lg:pl-64',
      brandMark: 'bg-[#ffb86b] text-[#1f3b3a] shadow-lg shadow-black/20',
      brandText: 'font-display text-white',
      brandSub: 'text-[#ffb86b]',
      navIdle: 'text-teal-100/70 hover:bg-white/10 hover:text-white',
      navActive: 'bg-[#ffb86b] font-semibold text-[#1f3b3a]',
      sidebarMuted: 'text-teal-100/60',
      sidebarDivider: 'border-white/10',
      header: 'bg-[#fbf6f0]/85 backdrop-blur-xl',
      iconButton: 'text-stone-500 hover:bg-orange-100/70 hover:text-stone-900',
      footer: 'text-stone-400',
      bottomNav: 'mx-3 mb-3 rounded-3xl bg-[#1f3b3a] shadow-2xl shadow-stone-900/30',
      bottomActive: 'text-[#ffb86b]',
      bottomIdle: 'text-teal-100/60',
      card: 'border border-orange-100 bg-white shadow-[0_8px_30px_rgba(120,72,20,0.06)]',
      cardHover: 'hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(120,72,20,0.12)]',
      iconBox: 'bg-orange-50 text-orange-600',
      badge: 'bg-[#1f3b3a] font-medium text-[#ffb86b]',
      chip: 'bg-orange-50 text-stone-600',
      ring: 'ring-orange-300',
    },
    nav: [
      overview('Your tasks and schedule for today.'),
      { slug: 'tasks', label: 'My tasks', short: 'Tasks', icon: ListChecks, description: 'Jobs assigned to you today.' },
      { slug: 'rooms', label: 'Room status', short: 'Rooms', icon: Sparkles, description: 'Mark rooms as cleaned and ready.' },
      { slug: 'schedule', label: 'Schedule', icon: CalendarDays, description: 'Your shifts for the week.' },
      { slug: 'requests', label: 'Requests', icon: LifeBuoy, description: 'Report a problem or ask for supplies.' },
      { slug: 'checklist', label: 'Checklists', icon: ClipboardCheck, description: 'Step-by-step room and safety checks.' },
    ],
  },
}
