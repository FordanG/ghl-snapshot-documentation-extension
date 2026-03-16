'use client'

import { useEffect, useState, useMemo } from 'react'
import { useUsage } from '@/lib/swr'

interface UsageRecord {
  id: string
  license_id: string
  licenses: { license_code: string; email: string | null; name: string | null } | null
  company_id: string | null
  snapshot_id: string | null
  ip_address: string | null
  user_agent: string | null
  used_at: string
}

interface UserGroup {
  license_code: string
  email: string | null
  name: string | null
  totalUses: number
  lastUsed: string
  companies: string[]
  records: UsageRecord[]
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function groupByUser(usage: UsageRecord[]): UserGroup[] {
  const map = new Map<string, UserGroup>()
  usage.forEach(u => {
    const key = u.licenses?.license_code ?? u.license_id ?? 'unknown'
    if (!map.has(key)) {
      map.set(key, {
        license_code: u.licenses?.license_code ?? key,
        email: u.licenses?.email ?? null,
        name: u.licenses?.name ?? null,
        totalUses: 0,
        lastUsed: u.used_at,
        companies: [],
        records: [],
      })
    }
    const group = map.get(key)!
    group.totalUses++
    if (u.used_at > group.lastUsed) group.lastUsed = u.used_at
    if (u.company_id && !group.companies.includes(u.company_id)) {
      group.companies.push(u.company_id)
    }
    group.records.push(u)
  })
  return Array.from(map.values()).sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))
}

export default function UsagePage() {
  const { data: usageRaw, isLoading: loading } = useUsage()
  const usage: UsageRecord[] = Array.isArray(usageRaw) ? usageRaw : []

  const groups = useMemo(() => groupByUser(usage), [usage])
  const [filtered, setFiltered] = useState<UserGroup[]>([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(groups.filter(g =>
      (g.license_code || '').toLowerCase().includes(q) ||
      (g.email || '').toLowerCase().includes(q) ||
      (g.name || '').toLowerCase().includes(q) ||
      g.companies.some(c => c.toLowerCase().includes(q))
    ))
  }, [search, groups])

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usage</h1>
        <p className="text-gray-400 text-sm mt-1">
          {loading ? 'Loading…' : `${groups.length} users · ${usage.length} total activations`}
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800">
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by email, license key, name, or company ID…"
            className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {loading ? (
          <div className="text-center text-gray-400 text-sm py-16">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-16">No usage records found.</div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-zinc-800">
            {filtered.map(g => {
              const isOpen = expanded.has(g.license_code)
              return (
                <div key={g.license_code}>
                  {/* Summary row */}
                  <button
                    onClick={() => toggleExpand(g.license_code)}
                    className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-violet-50/30 dark:hover:bg-violet-900/10 transition text-left"
                  >
                    <span className={`text-gray-300 dark:text-zinc-600 transition-transform text-xs ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold text-violet-700 dark:text-violet-400">{g.license_code}</div>
                        <div className="text-xs text-gray-400 dark:text-zinc-500 truncate">{g.email || '—'}</div>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-zinc-400 font-medium">{g.name || '—'}</div>
                      <div>
                        {g.companies.slice(0, 2).map(c => (
                          <span key={c} className="inline-block font-mono text-xs text-gray-400 dark:text-zinc-500 truncate max-w-[140px]">{c}</span>
                        ))}
                        {g.companies.length > 2 && (
                          <span className="text-xs text-gray-300 dark:text-zinc-600"> +{g.companies.length - 2}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{g.totalUses} <span className="text-xs font-normal text-gray-400">uses</span></div>
                        <div className="text-xs text-gray-300 dark:text-zinc-600">{fmtDateTime(g.lastUsed)}</div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail rows */}
                  {isOpen && (
                    <div className="bg-gray-50/50 dark:bg-zinc-950/50 border-t border-gray-100 dark:border-zinc-800">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-zinc-800">
                            <th className="text-left px-12 py-2 font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Company ID</th>
                            <th className="text-left px-4 py-2 font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Snapshot ID</th>
                            <th className="text-left px-4 py-2 font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">IP</th>
                            <th className="text-left px-4 py-2 font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Used At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.records.map(r => (
                            <tr key={r.id} className="border-b border-gray-50 dark:border-zinc-900 last:border-0">
                              <td className="px-12 py-2 font-mono text-gray-500 dark:text-zinc-400">{r.company_id || '—'}</td>
                              <td className="px-4 py-2 font-mono text-gray-400 dark:text-zinc-500">{r.snapshot_id ? r.snapshot_id.slice(0, 16) + '…' : '—'}</td>
                              <td className="px-4 py-2 text-gray-400 dark:text-zinc-500">{r.ip_address || '—'}</td>
                              <td className="px-4 py-2 text-gray-400 dark:text-zinc-500 whitespace-nowrap">{fmtDateTime(r.used_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
