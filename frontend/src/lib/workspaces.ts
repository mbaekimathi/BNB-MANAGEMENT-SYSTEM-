import {
  ArrowDownToLine,
  ArrowLeftRight,
  Award,
  Banknote,
  BarChart3,
  BedDouble,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CalendarCheck,
  CalendarDays,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  Clock,
  ConciergeBell,
  Contact,
  CreditCard,
  FileBarChart,
  Gift,
  Hourglass,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  MessageSquare,
  Package,
  PackageCheck,
  PackageSearch,
  Palette,
  Plus,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tags,
  TrendingUp,
  Truck,
  UserCheck,
  UserCircle,
  UserPlus,
  Users,
  Wallet,
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
  /** Sub-pages; when set, this item opens its own sidebar with these links. */
  children?: NavItem[]
  /** On a module's sub-page this label becomes the sidebar's only link —
   *  it appends `?register` so the page can open its register view/popup. */
  register?: string
}

/**
 * Tailwind classes that give each role workspace its own look.
 * Base utilities apply in light mode; `dark:` utilities take over in dark mode.
 */
export interface WorkspaceTheme {
  name: string
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
  /** Links shown under the signed-in user in the sidebar. */
  accountNav?: NavItem[]
}

const overview = (description: string): NavItem => ({
  slug: '',
  label: 'Overview',
  icon: LayoutDashboard,
  description,
})

/** Self-service clock in/out — every role except receptionists, whose till
 *  session doubles as their shift record. */
const clockInOut: NavItem = {
  slug: 'check-in',
  label: 'Employee clock in / out',
  short: 'Clock',
  icon: ConciergeBell,
  description: 'Clock in, track your working time and clock out.',
  children: [
    { slug: '', label: 'Clock in / out', short: 'Clock', icon: ConciergeBell, description: 'Clock in, track your working time and clock out.' },
  ],
}

/** Receptionists open/close the till instead of clocking in — the session
 *  covers attendance, cash, drawings and the till report in one place. */
const tillInOut: NavItem = {
  slug: 'till',
  label: 'Open / close till',
  short: 'Till',
  icon: Calculator,
  description: 'Open the till to start your shift, close it to end — your attendance follows the session.',
  children: [
    { slug: '', label: 'Open / close till', short: 'Till', icon: Calculator, description: 'Open the till to start your shift, close it to end — your attendance follows the session.' },
  ],
}

/** Synthetic nav item for the profile page reached from the header user menu. */
export const PROFILE_ITEM: NavItem = {
  slug: 'profile',
  label: 'My profile',
  icon: UserCircle,
  description: 'Your account details, photo and sign-in preferences.',
}

/** Synthetic nav item for the notifications page reached from the header bell. */
export const NOTIFICATIONS_ITEM: NavItem = {
  slug: 'notifications',
  label: 'Notifications',
  icon: Bell,
  description: 'Checkout reminders and front-desk alerts.',
}

export const WORKSPACES: Record<Role, Workspace> = {
  admin: {
    theme: {
      name: 'Obsidian',
      root: 'bg-zinc-100 text-zinc-800 dark:bg-[#0a0a0d] dark:text-zinc-100',
      glowA: 'bg-[radial-gradient(circle,rgba(244,63,94,0.14),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(190,18,60,0.08),transparent_60%)]',
      radius: 'rounded-xl',
      heading: 'font-sans font-semibold tracking-tight text-zinc-900 dark:text-white',
      muted: 'text-zinc-500 dark:text-zinc-400',
      accentText: 'text-rose-600 dark:text-rose-400',
      sidebar: 'border-r border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-[#0f0f13]',
      sidebarFrame: 'md:inset-y-0 md:left-0',
      contentOffset: 'md:pl-20 lg:pl-64',
      brandMark: 'bg-gradient-to-br from-rose-500 to-red-700 text-white shadow-lg shadow-rose-600/30',
      brandText: 'text-zinc-900 dark:text-white',
      brandSub: 'text-rose-600/80 dark:text-rose-400/80',
      navIdle: 'text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-white',
      navActive:
        'bg-rose-500/10 text-rose-700 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-rose-500 dark:bg-rose-500/10 dark:text-white',
      sidebarMuted: 'text-zinc-400 dark:text-zinc-500',
      sidebarDivider: 'border-zinc-200 dark:border-white/[0.06]',
      header: 'border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#0a0a0d]/80',
      iconButton: 'text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white',
      footer: 'border-t border-zinc-200 text-zinc-500 dark:border-white/[0.06]',
      bottomNav: 'border-t border-zinc-200 bg-white/95 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#0f0f13]/95',
      bottomActive: 'text-rose-600 dark:text-rose-400',
      bottomIdle: 'text-zinc-400 dark:text-zinc-500',
      card: 'border border-zinc-200 bg-white shadow-sm dark:border-white/[0.06] dark:bg-[#111116] dark:shadow-none',
      cardHover: 'hover:border-rose-400/50 hover:shadow-md dark:hover:border-rose-500/40 dark:hover:bg-[#15151b] dark:hover:shadow-none',
      iconBox: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
      badge: 'border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
      chip: 'border border-zinc-300/70 text-zinc-600 dark:border-white/[0.08] dark:text-zinc-300',
      ring: 'ring-rose-400/60 dark:ring-rose-500/60',
    },
    nav: [
      { ...overview('Company-wide control centre.'), label: 'Admin console', short: 'Console' },
      clockInOut,
      {
        slug: 'staff-accounts', label: 'Staff accounts', short: 'Staff', icon: Users, description: 'Activate, suspend and manage every staff account.',
        children: [
          { slug: '', label: 'All staff', short: 'Staff', icon: Users, description: 'Activate, suspend and manage every staff account.' },
        ],
      },
      {
        slug: 'branch-setup', label: 'Branch setup', short: 'Setup', icon: Building2, description: 'Add branches and assign their managers.',
        children: [
          { slug: '', label: 'Branches', short: 'Branches', icon: Building2, description: 'Add branches and assign their managers.' },
        ],
      },
      {
        slug: 'permissions', label: 'Permissions', short: 'Access', icon: ShieldCheck, description: 'Decide what each role can see and do.',
        children: [
          { slug: '', label: 'Permissions', short: 'Access', icon: ShieldCheck, description: 'Decide what each role can see and do.' },
        ],
      },
      {
        slug: 'audit-reports', label: 'Audit reports', short: 'Audit', icon: FileBarChart, description: 'Bookings, revenue and stock across the company.',
        children: [
          { slug: '', label: 'Audit reports', short: 'Audit', icon: FileBarChart, description: 'Bookings, revenue and stock across the company.' },
        ],
      },
      {
        slug: 'company-settings', label: 'Company settings', short: 'Config', icon: Settings, description: 'Company details, taxes and system preferences.',
        children: [
          { slug: '', label: 'Settings', short: 'Config', icon: Settings, description: 'Company details, taxes and system preferences.' },
        ],
      },
    ],
  },

  company_manager: {
    theme: {
      name: 'Royal Gold',
      root: 'bg-[#f7f4ee] text-slate-700 dark:bg-ink-950 dark:text-slate-100',
      glowA: 'bg-[radial-gradient(circle,rgba(233,185,100,0.24),transparent_60%)] dark:bg-[radial-gradient(circle,rgba(233,185,100,0.20),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(56,97,251,0.10),transparent_60%)] dark:bg-[radial-gradient(circle,rgba(56,97,251,0.20),transparent_60%)]',
      radius: 'rounded-2xl',
      heading: 'font-display font-medium text-slate-900 dark:text-white',
      muted: 'text-slate-500 dark:text-slate-400',
      accentText: 'text-gold-500 dark:text-gold-300',
      sidebar: 'border-r border-slate-200 bg-white/75 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.03]',
      sidebarFrame: 'md:inset-y-0 md:left-0',
      contentOffset: 'md:pl-20 lg:pl-64',
      brandMark: 'bg-gradient-to-br from-gold-300 to-gold-500 text-ink-950 shadow-lg shadow-gold-500/30',
      brandText: 'font-display text-slate-900 dark:text-white',
      brandSub: 'text-gold-500/90 dark:text-gold-300/80',
      navIdle: 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white',
      navActive: 'bg-gradient-to-r from-gold-400/25 to-transparent text-[#92600e] ring-1 ring-inset ring-gold-500/40 dark:from-gold-300/20 dark:text-gold-200 dark:ring-gold-300/25',
      sidebarMuted: 'text-slate-400 dark:text-slate-500',
      sidebarDivider: 'border-slate-200 dark:border-white/10',
      header: 'mx-3 mt-3 rounded-2xl border border-slate-200 bg-white/85 shadow-xl shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/70 dark:shadow-black/30',
      iconButton: 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white',
      footer: 'mx-3 mb-3 rounded-2xl border border-slate-200 bg-white/75 text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400',
      bottomNav: 'border-t border-slate-200 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/90',
      bottomActive: 'text-gold-500 dark:text-gold-300',
      bottomIdle: 'text-slate-400 dark:text-slate-500',
      card: 'border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:backdrop-blur-xl',
      cardHover: 'hover:border-gold-500/50 hover:shadow-md dark:hover:border-gold-300/40 dark:hover:bg-white/[0.06] dark:hover:shadow-none',
      iconBox: 'bg-gold-400/15 text-gold-500 dark:bg-gold-300/10 dark:text-gold-300',
      badge: 'border border-gold-500/30 bg-gold-400/10 text-[#92600e] dark:border-gold-300/30 dark:bg-gold-300/10 dark:text-gold-200',
      chip: 'border border-slate-300/70 text-slate-600 dark:border-white/10 dark:text-slate-300',
      ring: 'ring-gold-400/60 dark:ring-gold-300/60',
    },
    nav: [
      { ...overview('How every branch is performing today.'), label: 'Executive summary', short: 'Summary' },
      clockInOut,
      {
        slug: 'branch-performance', label: 'Branch performance', short: 'Branches', icon: Building2, description: 'Compare branches side by side.',
        children: [
          { slug: '', label: 'Performance', short: 'Branches', icon: Building2, description: 'Compare branches side by side.' },
        ],
      },
      {
        slug: 'income', label: 'Company income', short: 'Income', icon: BarChart3, description: 'Daily, monthly and yearly income.',
        children: [
          { slug: '', label: 'Income', short: 'Income', icon: BarChart3, description: 'Daily, monthly and yearly income.' },
        ],
      },
      {
        slug: 'occupancy-trends', label: 'Occupancy trends', short: 'Trends', icon: BedDouble, description: 'Room occupancy and booking trends.',
        children: [
          { slug: '', label: 'Occupancy', short: 'Trends', icon: BedDouble, description: 'Room occupancy and booking trends.' },
        ],
      },
      {
        slug: 'leadership', label: 'Branch leadership', short: 'Leaders', icon: Users, description: 'Branch teams and their managers.',
        children: [
          { slug: '', label: 'Leaders', short: 'Leaders', icon: Users, description: 'Branch teams and their managers.' },
        ],
      },
      {
        slug: 'board-reports', label: 'Board reports', short: 'Board', icon: FileBarChart, description: 'Export reports for the board.',
        children: [
          { slug: '', label: 'Board reports', short: 'Board', icon: FileBarChart, description: 'Export reports for the board.' },
        ],
      },
    ],
  },

  it_support: {
    theme: {
      name: 'Terminal',
      root: 'bg-slate-50 text-slate-800 dark:bg-[#04080b] dark:text-slate-200',
      glowA: 'bg-[radial-gradient(circle,rgba(34,211,238,0.16),transparent_60%)] dark:bg-[radial-gradient(circle,rgba(34,211,238,0.14),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(16,185,129,0.10),transparent_60%)] dark:bg-[radial-gradient(circle,rgba(16,185,129,0.08),transparent_60%)]',
      pattern: 'grid-pattern [mask-image:linear-gradient(to_bottom,black,transparent_80%)]',
      radius: 'rounded-md',
      heading: 'font-mono font-semibold uppercase tracking-wider text-slate-900 dark:text-cyan-50',
      muted: 'text-slate-500 dark:text-slate-400',
      accentText: 'text-cyan-600 dark:text-cyan-300',
      sidebar: 'border-r border-cyan-600/20 bg-white dark:border-cyan-400/15 dark:bg-[#060c10]',
      sidebarFrame: 'md:inset-y-0 md:left-0',
      contentOffset: 'md:pl-20 lg:pl-64',
      brandMark: 'bg-cyan-500 text-white shadow-[0_0_24px_rgba(8,145,178,0.35)] dark:bg-cyan-400 dark:text-[#04080b] dark:shadow-[0_0_24px_rgba(34,211,238,0.45)]',
      brandText: 'font-mono text-slate-900 dark:text-cyan-50',
      brandSub: 'font-mono text-cyan-600/80 dark:text-cyan-400/70',
      navIdle: 'font-mono text-slate-500 hover:bg-cyan-50 hover:text-cyan-700 dark:text-slate-400 dark:hover:bg-cyan-400/[0.05] dark:hover:text-cyan-200',
      navActive: 'bg-cyan-500/10 font-mono text-cyan-700 ring-1 ring-inset ring-cyan-500/40 dark:bg-cyan-400/[0.08] dark:text-cyan-300 dark:ring-cyan-400/40',
      sidebarMuted: 'font-mono text-slate-400 dark:text-slate-500',
      sidebarDivider: 'border-cyan-600/15 dark:border-cyan-400/15',
      header: 'border-b border-cyan-600/15 bg-white/85 backdrop-blur dark:border-cyan-400/15 dark:bg-[#04080b]/85',
      iconButton: 'text-slate-500 hover:bg-cyan-500/10 hover:text-cyan-700 dark:text-cyan-200/70 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-200',
      footer: 'border-t border-cyan-600/15 font-mono text-slate-400 dark:border-cyan-400/15 dark:text-cyan-300/50',
      bottomNav: 'border-t border-cyan-600/20 bg-white/95 backdrop-blur dark:border-cyan-400/20 dark:bg-[#060c10]/95',
      bottomActive: 'text-cyan-600 dark:text-cyan-300',
      bottomIdle: 'text-slate-400 dark:text-slate-500',
      card: 'border border-cyan-600/15 bg-white shadow-sm dark:border-cyan-400/15 dark:bg-[#071017] dark:shadow-none',
      cardHover: 'hover:border-cyan-500/50 hover:shadow-[0_0_24px_rgba(8,145,178,0.12)] dark:hover:border-cyan-400/50 dark:hover:shadow-[0_0_24px_rgba(34,211,238,0.12)]',
      iconBox: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-300',
      badge: 'border border-cyan-500/40 bg-cyan-500/10 font-mono text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-cyan-200',
      chip: 'border border-cyan-600/15 font-mono text-slate-600 dark:border-cyan-400/15 dark:text-slate-300',
      ring: 'ring-cyan-500/60 dark:ring-cyan-400/60',
    },
    nav: [
      { ...overview('Main dashboard for the whole system.'), label: 'Dashboard' },
      clockInOut,
      {
        slug: 'hr', label: 'HR management', short: 'HR', icon: Users, description: 'Employees, roles, activation and staff records.',
        children: [
          { ...overview('Staff numbers, activations and HR alerts.'), label: 'HR overview', short: 'HR home' },
          { slug: 'employee-records', label: 'Employee records', short: 'Employees', icon: Users, description: 'Every employee across all branches.' },
          { slug: 'activations', label: 'Pending activation', short: 'Pending', icon: UserCheck, description: 'New sign-ups waiting to be approved.' },
          { slug: 'role-assignment', label: 'Role assignment', short: 'Roles', icon: ShieldCheck, description: 'Assign roles and control what each role can see.' },
          { slug: 'branch-allocation', label: 'Branch allocation', short: 'Allocation', icon: Building2, description: 'Assign staff to the BnB branch they work at.' },
          { slug: 'attendance', label: 'Attendance', icon: CalendarCheck, description: 'Clock-ins, shifts and absences.' },
          { slug: 'leave', label: 'Leave', icon: CalendarDays, description: 'Leave requests and balances.' },
          { slug: 'payroll', label: 'Payroll', icon: Banknote, description: 'Salaries, allowances and deductions.' },
        ],
      },
      {
        slug: 'bnb', label: 'BnB management', short: 'BnB', icon: BedDouble, description: 'Branches, rooms, bookings and guests.',
        children: [
          { ...overview('Occupancy and activity across all branches.'), label: 'BnB overview', short: 'BnB home' },
          { slug: 'branch-approvals', label: 'Branch approvals', short: 'Approvals', icon: ClipboardCheck, description: 'Review and approve pending branch registrations.' },
          { slug: 'branch-directory', label: 'Branch directory', short: 'Directory', icon: Building2, description: 'Add and manage BnB branches.' },
          { slug: 'room-inventory', label: 'Room inventory', short: 'Inventory', icon: BedDouble, description: 'Room types, status and amenities.' },
          { slug: 'booking-log', label: 'Booking log', short: 'Log', icon: CalendarCheck, description: 'Reservations, check-ins and check-outs.' },
          { slug: 'housekeeping', label: 'Housekeeping', short: 'Cleaning', icon: Sparkles, description: 'Cleaning schedules and room readiness.' },
          { slug: 'rates', label: 'Rates & pricing', short: 'Rates', icon: Tags, description: 'Room rates, seasons and discounts.' },
        ],
      },
      {
        slug: 'store', label: 'Store management', short: 'Store', icon: Warehouse, description: 'Company and branch stores, stock and suppliers.',
        children: [
          { ...overview('Stock levels and store activity.'), label: 'Store overview', short: 'Store home' },
          { slug: 'stock-levels', label: 'Stock levels', short: 'Levels', icon: Boxes, description: 'Items held in the company and branch stores.' },
          { slug: 'supplier-register', label: 'Supplier register', short: 'Register', icon: Truck, description: 'Supplier contacts and price lists.' },
          { slug: 'order-tracking', label: 'Order tracking', short: 'Tracking', icon: ShoppingCart, description: 'Orders placed with suppliers.' },
          { slug: 'stock-movements', label: 'Stock movements', short: 'Movements', icon: PackageCheck, description: 'Stock moved between stores and branches.' },
          { slug: 'variance-checks', label: 'Variance checks', short: 'Variance', icon: ClipboardCheck, description: 'Regular counts and variances.' },
        ],
      },
      {
        slug: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Occupancy, revenue and performance reports.',
        children: [
          { ...overview('Key numbers for the whole business.'), label: 'Analytics overview', short: 'Insights' },
          { slug: 'occupancy-rates', label: 'Occupancy rates', short: 'Occupancy', icon: BedDouble, description: 'How full each branch is over time.' },
          { slug: 'revenue-analysis', label: 'Revenue analysis', short: 'Revenue', icon: TrendingUp, description: 'Income by branch, room type and period.' },
          { slug: 'staff-performance', label: 'Staff performance', short: 'Performance', icon: Users, description: 'Tasks, attendance and service quality.' },
          { slug: 'store-usage', label: 'Store usage', short: 'Usage', icon: Boxes, description: 'What each branch uses and spends.' },
          { slug: 'report-builder', label: 'Report builder', short: 'Builder', icon: FileBarChart, description: 'Download and schedule reports.' },
        ],
      },
      {
        slug: 'accounts', label: 'Accounts', icon: Wallet, description: 'Payments, expenses and financial records.',
        children: [
          { ...overview('Money in, money out and balances.'), label: 'Accounts overview', short: 'Finance' },
          { slug: 'payment-records', label: 'Payment records', short: 'Payments', icon: CreditCard, description: 'Guest payments and receipts.' },
          { slug: 'invoices', label: 'Invoices', icon: Receipt, description: 'Invoices sent to guests and clients.' },
          { slug: 'expenses', label: 'Expenses', icon: Banknote, description: 'Branch and company spending.' },
          { slug: 'general-ledger', label: 'General ledger', short: 'Ledger', icon: BookOpen, description: 'All financial transactions in one place.' },
          { slug: 'financial-statements', label: 'Financial statements', short: 'Statements', icon: FileBarChart, description: 'Profit and loss, and balance reports.' },
        ],
      },
      {
        slug: 'clients', label: 'Clients', icon: Contact, description: 'Guests and corporate clients.',
        children: [
          { ...overview('Who stays with you and how often.'), label: 'Clients overview', short: 'Clients home' },
          { slug: 'guest-profiles', label: 'Guest profiles', short: 'Profiles', icon: Contact, description: 'Guest profiles and stay history.' },
          { slug: 'corporate', label: 'Corporate clients', short: 'Corporate', icon: Building2, description: 'Companies with accounts and agreed rates.' },
          { slug: 'guest-feedback', label: 'Guest feedback', short: 'Feedback', icon: MessageSquare, description: 'Reviews and complaints from guests.' },
          { slug: 'loyalty', label: 'Loyalty rewards', short: 'Loyalty', icon: Award, description: 'Repeat guests and rewards.' },
        ],
      },
    ],
    accountNav: [
      { slug: 'settings', label: 'System settings', short: 'Settings', icon: Settings, description: 'Company details, security rules and system preferences.' },
    ],
  },

  company_store_manager: {
    theme: {
      name: 'Emerald Ledger',
      root: 'bg-[#f4faf6] text-slate-800 dark:bg-[#05110d] dark:text-emerald-50',
      glowA: 'bg-[radial-gradient(circle,rgba(16,185,129,0.16),transparent_60%)] dark:bg-[radial-gradient(circle,rgba(16,185,129,0.18),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(163,230,53,0.10),transparent_60%)] dark:bg-[radial-gradient(circle,rgba(163,230,53,0.08),transparent_60%)]',
      radius: 'rounded-2xl',
      heading: 'font-sans font-bold tracking-tight text-slate-900 dark:text-white',
      muted: 'text-slate-500 dark:text-emerald-100/55',
      accentText: 'text-emerald-600 dark:text-emerald-300',
      sidebar: 'border border-emerald-200/80 bg-white shadow-2xl shadow-emerald-900/5 dark:border-emerald-400/15 dark:bg-gradient-to-b dark:from-emerald-900/70 dark:to-[#071a13] dark:shadow-black/40',
      sidebarFrame: 'md:top-3 md:bottom-3 md:left-3 md:rounded-3xl',
      contentOffset: 'md:pl-[6.25rem] lg:pl-[17.75rem]',
      brandMark: 'bg-gradient-to-br from-emerald-300 to-lime-300 text-emerald-950 shadow-lg shadow-emerald-500/30',
      brandText: 'text-slate-900 dark:text-white',
      brandSub: 'text-emerald-600/80 dark:text-emerald-300/80',
      navIdle: 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-900 dark:text-emerald-100/60 dark:hover:bg-white/[0.06] dark:hover:text-white',
      navActive: 'bg-emerald-500 font-semibold text-white shadow-md shadow-emerald-500/25 dark:bg-emerald-400 dark:text-emerald-950 dark:shadow-lg dark:shadow-emerald-500/30',
      sidebarMuted: 'text-slate-400 dark:text-emerald-100/45',
      sidebarDivider: 'border-emerald-200/70 dark:border-emerald-400/15',
      header: 'bg-[#f4faf6]/70 backdrop-blur-md dark:bg-[#05110d]/70',
      iconButton: 'text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-100/70 dark:hover:bg-emerald-400/10 dark:hover:text-white',
      footer: 'text-slate-400 dark:text-emerald-100/40',
      bottomNav: 'mx-3 mb-3 rounded-2xl border border-emerald-200/80 bg-white/95 shadow-2xl shadow-emerald-900/10 backdrop-blur-xl dark:border-emerald-400/20 dark:bg-[#0a2119]/95 dark:shadow-black/50',
      bottomActive: 'text-emerald-600 dark:text-emerald-300',
      bottomIdle: 'text-slate-400 dark:text-emerald-100/45',
      card: 'border border-emerald-200/60 bg-white shadow-sm dark:border-emerald-400/10 dark:bg-emerald-950/40 dark:shadow-none',
      cardHover: 'hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-400/40 dark:hover:shadow-none',
      iconBox: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300',
      badge: 'bg-emerald-600 font-semibold text-white dark:bg-emerald-400 dark:text-emerald-950',
      chip: 'border border-emerald-200/70 text-slate-600 dark:border-emerald-400/15 dark:text-emerald-100/80',
      ring: 'ring-emerald-500/50 dark:ring-emerald-400/60',
    },
    nav: [
      { ...overview('Central store and supply across all branches.'), label: 'Supply overview', short: 'Supply' },
      clockInOut,
      {
        slug: 'central-store', label: 'Central store', short: 'Central', icon: Warehouse, description: 'Stock held at head office.',
        children: [
          { slug: '', label: 'Central stock', short: 'Central', icon: Warehouse, description: 'Stock held at head office.' },
        ],
      },
      {
        slug: 'supplier-contracts', label: 'Supplier contracts', short: 'Contracts', icon: Truck, description: 'Supplier contacts, prices and terms.',
        children: [
          { slug: '', label: 'Contracts', short: 'Contracts', icon: Truck, description: 'Supplier contacts, prices and terms.' },
        ],
      },
      {
        slug: 'purchase-orders', label: 'Purchase orders', short: 'Orders', icon: ShoppingCart, description: 'Order new stock and track deliveries.',
        children: [
          { slug: '', label: 'Orders', short: 'Orders', icon: ShoppingCart, description: 'Order new stock and track deliveries.' },
        ],
      },
      {
        slug: 'branch-transfers', label: 'Branch transfers', short: 'Transfers', icon: PackageCheck, description: 'Send stock out to branches.',
        children: [
          { slug: '', label: 'Transfers', short: 'Transfers', icon: PackageCheck, description: 'Send stock out to branches.' },
        ],
      },
      {
        slug: 'stock-reports', label: 'Stock reports', short: 'Reports', icon: FileBarChart, description: 'Usage, value and reorder levels.',
        children: [
          { slug: '', label: 'Reports', short: 'Reports', icon: FileBarChart, description: 'Usage, value and reorder levels.' },
        ],
      },
    ],
  },

  branch_store_manager: {
    theme: {
      name: 'Amber Warehouse',
      root: 'bg-[#faf7f2] text-stone-700 dark:bg-[#120e0a] dark:text-stone-100',
      glowA: 'bg-[radial-gradient(circle,rgba(245,158,11,0.16),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(234,88,12,0.10),transparent_60%)]',
      radius: 'rounded-xl',
      heading: 'font-sans font-extrabold tracking-tight text-stone-900 dark:text-white',
      muted: 'text-stone-500 dark:text-stone-400',
      accentText: 'text-amber-600 dark:text-amber-400',
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
      header: 'border-b border-amber-600/15 bg-[#faf7f2]/85 backdrop-blur dark:border-amber-500/15 dark:bg-[#120e0a]/85',
      iconButton: 'text-stone-500 hover:bg-amber-500/10 hover:text-amber-700 dark:text-stone-300 dark:hover:bg-amber-500/10 dark:hover:text-amber-300',
      footer: 'border-t border-amber-600/10 text-stone-400 dark:border-amber-500/10 dark:text-stone-500',
      bottomNav: 'bg-gradient-to-r from-amber-500 to-orange-700',
      bottomActive: 'text-white',
      bottomIdle: 'text-white/60',
      card: 'border border-amber-600/15 bg-white shadow-sm dark:border-amber-500/10 dark:bg-[#1a140e] dark:shadow-none',
      cardHover: 'hover:border-amber-400/60 hover:bg-amber-50 hover:shadow-md dark:hover:border-amber-400/50 dark:hover:bg-[#21180f] dark:hover:shadow-none',
      iconBox: 'bg-gradient-to-br from-amber-400 to-orange-600 text-white',
      badge: 'bg-amber-400/30 font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
      chip: 'border border-amber-600/20 text-stone-600 dark:border-amber-500/15 dark:text-stone-300',
      ring: 'ring-amber-400/70',
    },
    nav: [
      { ...overview("This branch's store at a glance."), label: 'Store desk', short: 'Desk' },
      clockInOut,
      {
        slug: 'branch-stock', label: 'Branch stock', short: 'Stock', icon: Boxes, description: 'Everything held in the branch store.',
        children: [
          { slug: '', label: 'Branch stock', short: 'Stock', icon: Boxes, description: 'Everything held in the branch store.' },
        ],
      },
      {
        slug: 'requisitions', label: 'Requisitions', short: 'Requests', icon: ClipboardList, description: 'Request stock from the company store.',
        children: [
          { slug: '', label: 'Requisitions', short: 'Requests', icon: ClipboardList, description: 'Request stock from the company store.' },
        ],
      },
      {
        slug: 'deliveries', label: 'Deliveries', icon: Truck, description: 'Receive and confirm incoming stock.',
        children: [
          { slug: '', label: 'Deliveries', short: 'Deliveries', icon: Truck, description: 'Receive and confirm incoming stock.' },
        ],
      },
      {
        slug: 'stock-counts', label: 'Stock counts', short: 'Counts', icon: PackageSearch, description: 'Count stock and record differences.',
        children: [
          { slug: '', label: 'Stock counts', short: 'Counts', icon: PackageSearch, description: 'Count stock and record differences.' },
        ],
      },
      {
        slug: 'reorder-report', label: 'Reorder report', short: 'Reorder', icon: FileBarChart, description: 'Branch usage and reorder needs.',
        children: [
          { slug: '', label: 'Reorder report', short: 'Reorder', icon: FileBarChart, description: 'Branch usage and reorder needs.' },
        ],
      },
    ],
  },

  branch_manager: {
    theme: {
      name: 'Indigo Aurora',
      root: 'bg-[#f7f5fd] text-slate-700 dark:bg-[#0b0820] dark:text-violet-50',
      glowA: 'bg-[radial-gradient(circle,rgba(139,92,246,0.18),transparent_60%)] dark:bg-[radial-gradient(circle,rgba(139,92,246,0.28),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(217,70,239,0.12),transparent_60%)] dark:bg-[radial-gradient(circle,rgba(217,70,239,0.18),transparent_60%)]',
      radius: 'rounded-2xl',
      heading: 'font-display font-semibold text-slate-900 dark:text-white',
      muted: 'text-slate-500 dark:text-violet-200/60',
      accentText: 'text-fuchsia-600 dark:text-fuchsia-300',
      sidebar: 'border border-violet-200/70 bg-white/85 shadow-2xl shadow-violet-950/5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] dark:shadow-violet-950/50',
      sidebarFrame: 'md:top-3 md:bottom-3 md:left-3 md:rounded-[1.75rem]',
      contentOffset: 'md:pl-[6.25rem] lg:pl-[17.75rem]',
      brandMark: 'bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/40',
      brandText: 'font-display text-slate-900 dark:text-white',
      brandSub: 'text-fuchsia-600/80 dark:text-fuchsia-300/80',
      navIdle: 'text-slate-500 hover:bg-violet-100/60 hover:text-slate-900 dark:text-violet-100/60 dark:hover:bg-white/[0.08] dark:hover:text-white',
      navActive: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-fuchsia-500/25 dark:shadow-lg dark:shadow-fuchsia-500/30',
      sidebarMuted: 'text-slate-400 dark:text-violet-200/50',
      sidebarDivider: 'border-violet-200/70 dark:border-white/10',
      header: 'mx-3 mt-3 rounded-2xl border border-violet-200/70 bg-white/85 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none',
      iconButton: 'text-slate-500 hover:bg-violet-100/70 hover:text-slate-900 dark:text-violet-100/70 dark:hover:bg-white/10 dark:hover:text-white',
      footer: 'text-slate-400 dark:text-violet-200/40',
      bottomNav: 'mx-3 mb-3 rounded-full border border-violet-200/70 bg-white/95 shadow-2xl shadow-violet-950/10 backdrop-blur-2xl dark:border-white/10 dark:bg-[#1a1240]/90 dark:shadow-black/50',
      bottomActive: 'text-fuchsia-600 dark:text-fuchsia-300',
      bottomIdle: 'text-slate-400 dark:text-violet-200/50',
      card: 'border border-violet-200/60 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none dark:backdrop-blur-xl',
      cardHover: 'hover:border-fuchsia-400/50 hover:bg-violet-50/70 dark:hover:border-fuchsia-400/40 dark:hover:bg-white/[0.08]',
      iconBox: 'bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 text-fuchsia-600 dark:from-violet-500/30 dark:to-fuchsia-500/30 dark:text-fuchsia-200',
      badge: 'bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-white',
      chip: 'border border-violet-200/80 text-slate-600 dark:border-white/10 dark:text-violet-100/80',
      ring: 'ring-fuchsia-400/50 dark:ring-fuchsia-400/60',
    },
    nav: [
      { ...overview('Your branch today: guests, rooms and team.'), label: 'Branch overview', short: 'Branch' },
      clockInOut,
      {
        slug: 'branch-bookings', label: 'Branch bookings', short: 'Bookings', icon: CalendarDays, description: 'All reservations for this branch.',
        children: [
          { slug: '', label: 'Upcoming & history', short: 'Bookings', icon: CalendarDays, description: 'Upcoming arrivals and recent booking history.' },
          { slug: 'new', label: 'New reservation', short: 'New', icon: UserPlus, description: 'Hold a room for a client\'s future stay.' },
        ],
      },
      {
        slug: 'room-management', label: 'Room management', short: 'Rooms', icon: BedDouble, description: 'Room status, prices and maintenance.',
        children: [
          { slug: '', label: 'Rooms', short: 'Rooms', icon: BedDouble, description: 'Room status, prices and maintenance.' },
          { slug: 'register', label: 'Register room', short: 'Register', icon: Plus, description: 'Add a new room to your branch.' },
        ],
      },
      {
        slug: 'extra-packages', label: 'Extra packages', short: 'Packages', icon: Package, description: 'Add-ons sold on top of a stay — spa, dining, pickups and tours.',
        children: [
          { slug: '', label: 'All packages', short: 'Packages', icon: Package, description: 'Extra packages guests can buy on top of their stay.' },
          { slug: 'register', label: 'Register package', short: 'Register', icon: Plus, description: 'Add a new extra package to your branch.' },
        ],
      },
      {
        slug: 'team-shifts', label: 'Team & shifts', short: 'Team', icon: Users, description: 'Staff at your branch — register them, hand out tasks and manage shifts.',
        children: [
          { slug: '', label: 'Team & shifts', short: 'Team', icon: Users, description: 'Everyone allocated to your branch, plus the tasks you assign them.' },
          { slug: 'tasks', label: 'Tasks', short: 'Tasks', icon: ListChecks, description: 'Hand out tasks to your team and track their progress.' },
          { slug: 'pending-approval', label: 'Pending approval', short: 'Pending', icon: UserCheck, description: 'New staff allocated to your branch, waiting for your approval.' },
          { slug: 'register', label: 'Register employee', short: 'Register', icon: UserPlus, description: 'Add a staff member to your branch.' },
        ],
      },
      {
        slug: 'guest-history', label: 'Guest history', short: 'History', icon: UserCircle, description: 'Guest history and feedback.',
        children: [
          { slug: '', label: 'All clients', short: 'Clients', icon: UserCircle, description: 'Every client who booked at this branch.' },
          { slug: 'reservations', label: 'Reservations', short: 'Reserved', icon: CalendarCheck, description: 'Clients with upcoming reservations.' },
          { slug: 'in-house', label: 'In house', short: 'In house', icon: BedDouble, description: 'Clients checked in right now.' },
          { slug: 'day-rest', label: 'Day rest', short: 'Day rest', icon: Hourglass, description: 'Clients who booked day rests.' },
        ],
      },
      {
        slug: 'referrals', label: 'Referrals', short: 'Referrals', icon: Gift, description: 'Client referrals, voucher maturity and redemptions.',
        children: [
          { slug: '', label: 'Referrals & vouchers', short: 'Referrals', icon: Gift, description: 'Client referrals, voucher maturity and redemptions.' },
        ],
      },
      {
        slug: 'tickets', label: 'Tickets', short: 'Tickets', icon: LifeBuoy, description: 'Register and track maintenance, housekeeping and guest tickets at this branch.',
        children: [
          { slug: '', label: 'All tickets', short: 'Tickets', icon: LifeBuoy, description: 'Track maintenance, housekeeping and guest tickets at this branch.' },
          { slug: 'register', label: 'Register ticket', short: 'Register', icon: ClipboardList, description: 'Log a maintenance, housekeeping or guest ticket.' },
        ],
      },
      {
        slug: 'branch-reports', label: 'Branch results', short: 'Results', icon: FileBarChart, description: 'Branch income and occupancy.',
        children: [
          { slug: '', label: 'Branch results', short: 'Results', icon: FileBarChart, description: 'Branch income and occupancy.' },
        ],
      },
    ],
    accountNav: [
      {
        slug: 'branch-settings', label: 'Branch settings', short: 'Settings', icon: Settings, description: 'Branch details, payment methods and guest messaging.',
        children: [
          { slug: '', label: 'Company details', short: 'Details', icon: Building2, description: 'Branch name, contacts, location and picture.' },
          { slug: 'theme', label: 'Company theme', short: 'Theme', icon: Palette, description: 'Pick the workspace theme each staff role sees.' },
          { slug: 'payments', label: 'Branch payments', short: 'Payments', icon: CreditCard, description: 'Accepted payment methods and provider API keys.' },
          { slug: 'communications', label: 'Branch communications', short: 'Comms', icon: MessageSquare, description: 'Message drafts, their triggers and channel API keys.' },
          { slug: 'time', label: 'Branch time', short: 'Hours', icon: Clock, description: 'Opening hours and guest check-in / check-out times.' },
        ],
      },
    ],
  },

  branch_receptionist: {
    theme: {
      name: 'Coastal Light',
      root: 'bg-[#f3f7fb] text-slate-700 dark:bg-[#08131c] dark:text-slate-200',
      glowA: 'bg-[radial-gradient(circle,rgba(14,165,233,0.14),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(20,184,166,0.10),transparent_60%)]',
      radius: 'rounded-2xl',
      heading: 'font-sans font-semibold tracking-tight text-slate-900 dark:text-sky-50',
      muted: 'text-slate-500 dark:text-slate-400',
      accentText: 'text-sky-600 dark:text-sky-300',
      sidebar: 'border-r border-slate-200/80 bg-white shadow-[4px_0_24px_rgba(15,23,42,0.04)] dark:border-sky-400/10 dark:bg-[#0a1822] dark:shadow-none',
      sidebarFrame: 'md:inset-y-0 md:left-0',
      contentOffset: 'md:pl-20 lg:pl-64',
      brandMark: 'bg-gradient-to-br from-sky-400 to-teal-500 text-white shadow-lg shadow-sky-500/30',
      brandText: 'text-slate-900 dark:text-sky-50',
      brandSub: 'text-sky-600 dark:text-sky-400/80',
      navIdle: 'text-slate-500 hover:bg-sky-50 hover:text-sky-700 dark:text-slate-400 dark:hover:bg-sky-400/[0.06] dark:hover:text-sky-200',
      navActive: 'bg-sky-500 text-white shadow-md shadow-sky-500/30 dark:bg-sky-400 dark:text-[#052433] dark:shadow-sky-400/20',
      sidebarMuted: 'text-slate-400 dark:text-slate-500',
      sidebarDivider: 'border-slate-200 dark:border-sky-400/10',
      header: 'border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-sky-400/10 dark:bg-[#08131c]/85',
      iconButton: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-sky-400/10 dark:hover:text-sky-200',
      footer: 'border-t border-slate-200 bg-white text-slate-400 dark:border-sky-400/10 dark:bg-transparent dark:text-slate-500',
      bottomNav: 'border-t border-slate-200 bg-white/95 backdrop-blur-xl dark:border-sky-400/10 dark:bg-[#0a1822]/95',
      bottomActive: 'text-sky-600 dark:text-sky-300',
      bottomIdle: 'text-slate-400 dark:text-slate-500',
      card: 'border border-slate-200/80 bg-white shadow-sm dark:border-sky-400/10 dark:bg-[#0d1f2b] dark:shadow-none',
      cardHover: 'hover:border-sky-300 hover:shadow-lg hover:shadow-sky-500/10 dark:hover:border-sky-400/40',
      iconBox: 'bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300',
      badge: 'bg-sky-50 font-medium text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-400/10 dark:text-sky-200 dark:ring-sky-400/30',
      chip: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
      ring: 'ring-sky-400/70',
    },
    nav: [
      { ...overview("Today's arrivals, departures and guests in house."), label: 'Front desk', short: 'Front' },
      tillInOut,
      {
        slug: 'register-client', label: 'Register client', short: 'Register', icon: UserPlus, description: 'Take a reservation, check a guest in or book a day rest.',
        children: [
          { slug: '', label: 'Reserve a room', short: 'Reserve', icon: CalendarCheck, description: 'Hold the room for a future date.' },
          { slug: 'check-in', label: 'Check in now', short: 'Check-in', icon: BedDouble, description: 'The guest takes the room today.' },
          { slug: 'day-rest', label: 'Day rest', short: 'Day rest', icon: Hourglass, description: 'A few hours in the room.' },
        ],
      },
      {
        slug: 'guests-in-house', label: 'Guest all transactions', short: 'All', icon: Users, description: 'In-house guests, reservations and day rests.',
        children: [
          { slug: '', label: 'All transactions', short: 'All', icon: Receipt, description: 'In-house guests, reservations and day rests.' },
          { slug: 'in-house', label: 'In house', short: 'In house', icon: Users, description: 'Guests currently checked in.' },
          { slug: 'check-out', label: 'Check out clients', short: 'Check out', icon: LogOut, description: 'Guests due out today — tick them off and check out several at once.' },
          { slug: 'reservations', label: 'Reservations', short: 'Reserve', icon: CalendarCheck, description: 'Take and change bookings.' },
          { slug: 'day-rest', label: 'Day rest', short: 'Day rest', icon: Hourglass, description: 'Live day-rest sessions and recent ones.' },
        ],
      },
      {
        slug: 'clients', label: 'Clients', short: 'Clients', icon: Contact, description: 'Client profiles, stay history and payment records at this branch.',
        children: [
          { slug: '', label: 'All clients', short: 'Clients', icon: Contact, description: 'Client profiles, stay history and payment records at this branch.' },
        ],
      },
      {
        slug: 'referrals', label: 'Vouchers', short: 'Vouchers', icon: Gift, description: 'Client referrals, voucher maturity and gift redemptions.',
        children: [
          { slug: '', label: 'Vouchers', short: 'Vouchers', icon: Gift, description: 'Client referrals, voucher maturity and gift redemptions.' },
        ],
      },
      {
        slug: 'tickets', label: 'Tickets', short: 'Tickets', icon: LifeBuoy, description: 'Register and track maintenance, housekeeping and guest tickets at this branch.',
        children: [
          { slug: '', label: 'All tickets', short: 'Tickets', icon: LifeBuoy, description: 'Track maintenance, housekeeping and guest tickets at this branch.' },
          { slug: 'register', label: 'Register ticket', short: 'Register', icon: ClipboardList, description: 'Log a maintenance, housekeeping or guest ticket.' },
        ],
      },
      {
        slug: 'room-availability', label: 'Room availability', short: 'Free rooms', icon: BedDouble, description: 'Which rooms are free, booked or being cleaned.',
        children: [
          { slug: '', label: 'Availability board', short: 'Rooms', icon: BedDouble, description: 'Which rooms are free, booked or being cleaned.' },
        ],
      },
      {
        slug: 'accounts', label: 'Accounts', short: 'Accounts', icon: Wallet, description: 'Income records, expenses, stock purchases, commissions and branch reports.',
        children: [
          { slug: '', label: 'Income records', short: 'Income', icon: TrendingUp, description: 'Room revenue, deposits and advance payments — filled automatically from bookings.' },
          { slug: 'expenses', label: 'Expense', short: 'Expenses', icon: Banknote, description: 'Branch spending records — category, expense name, amount, who it went to and payment status.', register: 'Register expense' },
          { slug: 'stock', label: 'Stock', short: 'Stock', icon: ShoppingCart, description: 'Stock bought from suppliers — supplier details, item, buying price and payment status.', register: 'Buy stock' },
          { slug: 'counter', label: 'Counter', short: 'Counter', icon: Calculator, description: 'Open and close the till, register drawings and review till reports.' },
          { slug: 'drawings', label: 'Drawings', short: 'Drawings', icon: ArrowDownToLine, description: 'Money drawn from the till — cash, M-Pesa or Visa card.', register: 'Register drawing' },
          { slug: 'commissions', label: 'Commissions & gifts', short: 'Gifts', icon: Gift, description: 'Referral gift vouchers and commissions — generated automatically.' },
        ],
      },
      {
        slug: 'reports', label: 'Reports', short: 'Reports', icon: BarChart3, description: 'Money flow, cash, room, client, referral and package reports.',
        children: [
          { slug: '', label: 'General money flow report', short: 'Money flow', icon: ArrowLeftRight, description: 'Money in and out across all channels — the branch net position for any period.' },
          { slug: 'cash', label: 'Cash summary report', short: 'Cash report', icon: FileBarChart, description: 'Shift cash summary — room ledger plus M-Pesa, cash and Visa summaries.' },
          { slug: 'rooms', label: 'Room summary report', short: 'Room report', icon: BedDouble, description: 'Per-room stays, nights and revenue for any period.' },
          { slug: 'clients', label: 'Client summary report', short: 'Client report', icon: Users, description: 'Per-client stays, spend, vouchers and extra packages.' },
          { slug: 'referrals', label: 'Referral summary report', short: 'Referral report', icon: Gift, description: 'Gift vouchers earned, matured and redeemed.' },
          { slug: 'packages', label: 'Extra packages report', short: 'Package report', icon: PackageSearch, description: 'Extra package sales by item, guest and period.' },
        ],
      },
    ],
  },

  branch_employee: {
    theme: {
      name: 'Sunrise',
      root: 'bg-[#fbf6f0] text-stone-700 dark:bg-[#161210] dark:text-stone-200',
      glowA: 'bg-[radial-gradient(circle,rgba(251,146,60,0.16),transparent_60%)]',
      glowB: 'bg-[radial-gradient(circle,rgba(45,212,191,0.12),transparent_60%)]',
      radius: 'rounded-3xl',
      heading: 'font-display font-semibold text-stone-900 dark:text-stone-50',
      muted: 'text-stone-500 dark:text-stone-400',
      accentText: 'text-orange-600 dark:text-[#ffb86b]',
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
      header: 'bg-[#fbf6f0]/85 backdrop-blur-xl dark:bg-[#161210]/85',
      iconButton: 'text-stone-500 hover:bg-orange-100/70 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/[0.07] dark:hover:text-[#ffb86b]',
      footer: 'text-stone-400 dark:text-stone-500',
      bottomNav: 'mx-3 mb-3 rounded-3xl bg-[#1f3b3a] shadow-2xl shadow-stone-900/30',
      bottomActive: 'text-[#ffb86b]',
      bottomIdle: 'text-teal-100/60',
      card: 'border border-orange-100 bg-white shadow-[0_8px_30px_rgba(120,72,20,0.06)] dark:border-white/[0.08] dark:bg-[#1e1a17] dark:shadow-none',
      cardHover: 'hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(120,72,20,0.12)] dark:hover:border-[#ffb86b]/40 dark:hover:shadow-none',
      iconBox: 'bg-orange-50 text-orange-600 dark:bg-[#ffb86b]/10 dark:text-[#ffb86b]',
      badge: 'bg-[#1f3b3a] font-medium text-[#ffb86b]',
      chip: 'bg-orange-50 text-stone-600 dark:bg-white/[0.06] dark:text-stone-300',
      ring: 'ring-orange-300 dark:ring-[#ffb86b]/60',
    },
    nav: [
      { ...overview('Your tasks and schedule for today.'), label: 'My day', short: 'Today' },
      clockInOut,
      {
        slug: 'tasks', label: 'My tasks', short: 'Tasks', icon: ListChecks, description: 'Jobs assigned to you today.',
        children: [
          { slug: '', label: 'My tasks', short: 'Tasks', icon: ListChecks, description: 'Jobs assigned to you today.' },
        ],
      },
      {
        slug: 'room-status', label: 'Room status', short: 'Status', icon: Sparkles, description: 'Mark rooms as cleaned and ready.',
        children: [
          { slug: '', label: 'Room status', short: 'Status', icon: Sparkles, description: 'Mark rooms as cleaned and ready.' },
        ],
      },
      {
        slug: 'schedule', label: 'My schedule', short: 'Schedule', icon: CalendarDays, description: 'Your shifts for the week.',
        children: [
          { slug: '', label: 'My schedule', short: 'Schedule', icon: CalendarDays, description: 'Your shifts for the week.' },
        ],
      },
      {
        slug: 'report-issue', label: 'Report an issue', short: 'Issues', icon: LifeBuoy, description: 'Report a problem or ask for supplies.',
        children: [
          { slug: '', label: 'Report issue', short: 'Issues', icon: LifeBuoy, description: 'Report a problem or ask for supplies.' },
        ],
      },
      {
        slug: 'checklist', label: 'Checklists', short: 'Checks', icon: ClipboardCheck, description: 'Step-by-step room and safety checks.',
        children: [
          { slug: '', label: 'Checklists', short: 'Checks', icon: ClipboardCheck, description: 'Step-by-step room and safety checks.' },
        ],
      },
    ],
  },
}

/** Every workspace theme by display name — used when a branch overrides the
 *  theme a role signs in with (Branch settings → Company theme). */
export const THEMES: Record<string, WorkspaceTheme> = Object.fromEntries(
  Object.values(WORKSPACES).map((w) => [w.theme.name, w.theme]),
)

/** The theme names a branch manager can assign to each staff role. */
export const THEME_NAMES = Object.values(WORKSPACES).map((w) => w.theme.name)
