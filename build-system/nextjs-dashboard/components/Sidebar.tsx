'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback } from 'react'
import LogoutButton from './LogoutButton'
import { useTheme } from './ThemeProvider'
import { prefetch, KEYS } from '@/lib/swr'

const navItems = [
  { href: '/dashboard',           icon: '\u{1F4CA}', label: 'Overview',         prefetchKeys: [KEYS.stats, KEYS.licenses, KEYS.usage] },
  { href: '/dashboard/revenue',   icon: '\u{1F4B0}', label: 'Revenue',          prefetchKeys: [KEYS.revenue] },
  { href: '/dashboard/licenses',  icon: '\u{1F511}', label: 'Licenses',         prefetchKeys: [KEYS.licenses] },
  { href: '/dashboard/usage',     icon: '\u{1F4C8}', label: 'Usage',            prefetchKeys: [KEYS.usage] },
  { href: '/dashboard/generate',  icon: '\u2728',     label: 'Generate License', prefetchKeys: [] },
]

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  const handlePrefetch = useCallback((keys: string[]) => {
    keys.forEach(prefetch)
  }, [])

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-52 bg-white dark:bg-zinc-950 border-r border-gray-100 dark:border-zinc-800 flex flex-col z-10">
      <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-700 to-violet-400 flex items-center justify-center text-white text-sm">
          ⚡
        </div>
        <span className="font-bold text-gray-900 dark:text-white text-sm">Snapshot AI</span>
      </div>

      <nav className="p-2.5 flex-1 space-y-0.5">
        {navItems.map(({ href, icon, label, prefetchKeys }) => {
          const active = href === '/dashboard'
            ? pathname === href
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onMouseEnter={() => handlePrefetch(prefetchKeys)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition ${
                active
                  ? 'bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-400 font-semibold'
                  : 'text-gray-500 dark:text-zinc-400 hover:bg-violet-50 dark:hover:bg-violet-950/50 hover:text-violet-700 dark:hover:text-violet-400'
              }`}
            >
              <span>{icon}</span> {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-100 dark:border-zinc-800 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
        >
          {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
        </button>
        <div className="px-3 py-1">
          <div className="text-xs text-gray-400 dark:text-zinc-600 truncate">{userEmail}</div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  )
}
