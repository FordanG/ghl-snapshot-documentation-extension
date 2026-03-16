'use client'

import { useRevenue } from '@/lib/swr'

interface RevenueData {
  totalRevenue: number
  gabrielShare: number
  ferShare: number
  paidCount: number
  freeCount: number
  pricePerLicense: number
  launchDate: string
  byMonth: { month: string; revenue: number; count: number }[]
  recentPaid: {
    id: string
    license_code: string
    email: string | null
    name: string | null
    created_at: string
  }[]
}

function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RevenuePage() {
  const { data, isLoading: loading } = useRevenue()
  const rev = data as RevenueData | undefined

  const maxMonthRevenue = Math.max(...(rev?.byMonth.map(m => m.revenue) ?? [1]))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revenue</h1>
        <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">
          ${rev?.pricePerLicense ?? 97}/license · launch {rev?.launchDate ?? '2026-03-12'}
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-violet-700 to-violet-500 rounded-xl p-6 text-white">
          <div className="text-sm font-medium opacity-75 mb-1">Total Revenue</div>
          <div className="text-4xl font-bold mb-1">
            {loading ? '—' : fmt$(rev!.totalRevenue)}
          </div>
          <div className="text-xs opacity-60">{loading ? '—' : rev!.paidCount} paid licenses</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <div className="text-sm font-medium text-gray-600 dark:text-zinc-400">Gabriel&apos;s Share (50%)</div>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {loading ? '—' : fmt$(rev!.gabrielShare)}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-pink-400" />
            <div className="text-sm font-medium text-gray-600 dark:text-zinc-400">Fer&apos;s Share (50%)</div>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {loading ? '—' : fmt$(rev!.ferShare)}
          </div>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-5 flex items-center gap-4">
          <div className="text-3xl">💳</div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '—' : rev!.paidCount}</div>
            <div className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide font-medium">Paid Licenses</div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-5 flex items-center gap-4">
          <div className="text-3xl">🎁</div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '—' : rev!.freeCount}</div>
            <div className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide font-medium">Free Licenses</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly breakdown */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm mb-4">Revenue by Month</h3>
          {loading ? (
            <div className="text-xs text-gray-300 dark:text-zinc-700">Loading…</div>
          ) : !rev?.byMonth.length ? (
            <div className="text-xs text-gray-300 dark:text-zinc-700">No revenue yet.</div>
          ) : (
            <div className="space-y-3">
              {rev.byMonth.map(m => (
                <div key={m.month}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-zinc-400 font-medium">{m.month}</span>
                    <span className="text-gray-900 dark:text-white font-semibold">
                      {fmt$(m.revenue)}
                      <span className="text-gray-400 dark:text-zinc-500 font-normal ml-1">
                        ({m.count} license{m.count !== 1 ? 's' : ''})
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-violet-700 to-violet-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${(m.revenue / maxMonthRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent paid licenses */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm mb-4">Recent Paid Licenses</h3>
          {loading ? (
            <div className="text-xs text-gray-300 dark:text-zinc-700">Loading…</div>
          ) : !rev?.recentPaid.length ? (
            <div className="text-xs text-gray-300 dark:text-zinc-700">No paid licenses yet.</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-zinc-800">
              {rev.recentPaid.map(l => (
                <div key={l.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-mono text-xs font-bold text-violet-700 dark:text-violet-400">{l.license_code}</div>
                    <div className="text-xs text-gray-400 dark:text-zinc-500">{l.name || l.email || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{fmt$(rev!.pricePerLicense)}</div>
                    <div className="text-xs text-gray-300 dark:text-zinc-600">{fmtDate(l.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
