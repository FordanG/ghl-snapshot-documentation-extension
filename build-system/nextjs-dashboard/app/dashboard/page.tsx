'use client'

import { useStats, useLicenses, useUsage } from '@/lib/swr'

interface License {
  id: string
  license_code: string
  email: string | null
  name: string | null
  created_at: string
  is_active: boolean
}

interface UsageRecord {
  id: string
  licenses: { license_code: string; email: string | null } | null
  company_id: string | null
  used_at: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: licensesRaw, isLoading: licensesLoading } = useLicenses()
  const { data: usageRaw, isLoading: usageLoading } = useUsage()

  const loading = statsLoading || licensesLoading || usageLoading
  const recentLicenses: License[] = Array.isArray(licensesRaw) ? licensesRaw.slice(0, 6) : []
  const recentUsage: UsageRecord[] = Array.isArray(usageRaw) ? usageRaw.slice(0, 6) : []

  const statCards = [
    { label: 'Total Licenses',  value: stats?.totalLicenses,  icon: '🔑' },
    { label: 'Active Licenses', value: stats?.activeLicenses, icon: '✅' },
    { label: 'Total Usages',    value: stats?.totalUsage,     icon: '📊' },
    { label: 'Usage Today',     value: stats?.usageToday,     icon: '🔥' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h1>
        <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">Super Snapshot AI at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(c => (
          <div key={c.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-5">
            <div className="text-2xl mb-3">{c.icon}</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {loading ? <span className="text-gray-200 dark:text-zinc-700">—</span> : c.value ?? 0}
            </div>
            <div className="text-xs text-gray-400 dark:text-zinc-500 font-medium uppercase tracking-wide">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm mb-4">Recent Licenses</h3>
          {loading ? (
            <div className="text-xs text-gray-300 dark:text-zinc-700">Loading…</div>
          ) : recentLicenses.length === 0 ? (
            <div className="text-xs text-gray-300 dark:text-zinc-700">No licenses yet.</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-zinc-800">
              {recentLicenses.map(l => (
                <div key={l.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-mono text-xs font-bold text-violet-700 dark:text-violet-400">{l.license_code}</div>
                    <div className="text-xs text-gray-400 dark:text-zinc-500">{l.email || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-300 dark:text-zinc-600">{fmtDate(l.created_at)}</div>
                    <span className={`text-xs font-medium ${l.is_active ? 'text-green-600 dark:text-green-500' : 'text-red-400'}`}>
                      {l.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm mb-4">Recent Usage</h3>
          {loading ? (
            <div className="text-xs text-gray-300 dark:text-zinc-700">Loading…</div>
          ) : recentUsage.length === 0 ? (
            <div className="text-xs text-gray-300 dark:text-zinc-700">No usage yet.</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-zinc-800">
              {recentUsage.map(u => (
                <div key={u.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-mono text-xs font-bold text-violet-700 dark:text-violet-400">
                      {u.licenses?.license_code || '—'}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-zinc-500">
                      {u.licenses?.email || u.company_id || '—'}
                    </div>
                  </div>
                  <span className="text-xs text-gray-300 dark:text-zinc-600">{fmtDateTime(u.used_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
