'use client'

import { useState } from 'react'
import { useRevenue, usePayouts, revalidateAll } from '@/lib/swr'

interface RevenueData {
  totalRevenue: number
  paymentFees: number
  netRevenue: number
  gabrielShare: number
  ferShare: number
  gabrielPaidOut: number
  gabrielBalance: number
  paidCount: number
  freeCount: number
  pricePerLicense: number
  launchDate: string
  byMonth: { month: string; revenue: number; count: number }[]
  byBiweek: { period: string; revenue: number; count: number }[]
  recentPaid: {
    id: string
    license_code: string
    email: string | null
    name: string | null
    created_at: string
    price: number
  }[]
}

type View = 'monthly' | 'biweekly'

function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Payout {
  id: string
  recipient: string
  amount: number
  paid_at: string
  note: string | null
}

export default function RevenuePage() {
  const { data, isLoading: loading } = useRevenue()
  const { data: payoutsData } = usePayouts()
  const payouts = (payoutsData as Payout[] | undefined) ?? []
  const rev = data as RevenueData | undefined
  const [view, setView] = useState<View>('monthly')
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function submitPayout(e: React.FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount)
    if (!n || n <= 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin?type=payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: 'Gabriel Fordan',
          amount: n,
          paid_at: new Date(paidAt).toISOString(),
          note: note || null,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setAmount('')
      setNote('')
      setPaidAt(new Date().toISOString().slice(0, 10))
      setShowForm(false)
      revalidateAll()
    } finally {
      setSaving(false)
    }
  }

  async function deletePayout(id: string) {
    if (!confirm('Delete this payout?')) return
    await fetch('/api/admin?type=payout', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    revalidateAll()
  }

  const chartData = view === 'monthly' ? rev?.byMonth : rev?.byBiweek
  const chartLabel = view === 'monthly' ? 'month' : 'period'
  const maxRevenue = Math.max(...(chartData?.map(m => m.revenue) ?? [1]))

  const viewBtnCls = (v: View) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
      view === v
        ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300'
        : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
    }`

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revenue</h1>
        <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">
          Launch {rev?.launchDate ?? '2026-03-12'}
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
          {!loading && (
            <div className="mt-3 pt-3 border-t border-white/20 text-xs opacity-80 space-y-0.5">
              <div className="flex justify-between"><span>Payment fees (4%)</span><span>−{fmt$(rev!.paymentFees)}</span></div>
              <div className="flex justify-between font-semibold"><span>Net</span><span>{fmt$(rev!.netRevenue)}</span></div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <div className="text-sm font-medium text-gray-600 dark:text-zinc-400">Gabriel&apos;s Share (50%)</div>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {loading ? '—' : fmt$(rev!.gabrielShare)}
          </div>
          {!loading && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs">
              <div>
                <div className="text-gray-400 dark:text-zinc-500">Paid out</div>
                <div className="font-semibold text-gray-700 dark:text-zinc-300">{fmt$(rev!.gabrielPaidOut)}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-400 dark:text-zinc-500">Balance</div>
                <div className={`font-semibold ${rev!.gabrielBalance > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-gray-500 dark:text-zinc-500'}`}>
                  {fmt$(rev!.gabrielBalance)}
                </div>
              </div>
            </div>
          )}
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
        {/* Revenue breakdown with view toggle */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">
              Revenue by {view === 'monthly' ? 'Month' : 'Biweek'}
            </h3>
            <div className="flex gap-1">
              <button onClick={() => setView('monthly')} className={viewBtnCls('monthly')}>Monthly</button>
              <button onClick={() => setView('biweekly')} className={viewBtnCls('biweekly')}>Biweekly</button>
            </div>
          </div>
          {loading ? (
            <div className="text-xs text-gray-300 dark:text-zinc-700">Loading…</div>
          ) : !chartData?.length ? (
            <div className="text-xs text-gray-300 dark:text-zinc-700">No revenue yet.</div>
          ) : (
            <div className="space-y-3">
              {chartData.map((m) => {
                const label = (m as Record<string, unknown>)[chartLabel] as string
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-zinc-400 font-medium">{label}</span>
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
                        style={{ width: `${(m.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
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
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{fmt$(l.price)}</div>
                    <div className="text-xs text-gray-300 dark:text-zinc-600">{fmtDate(l.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payouts to Gabriel */}
      <div className="mt-6 bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-zinc-200 text-sm">Payouts to Gabriel Fordan</h3>
          <button
            onClick={() => setShowForm(s => !s)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition"
          >
            {showForm ? 'Cancel' : '+ Record Payout'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submitPayout} className="mb-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3">
            <label className="text-xs">
              <div className="text-gray-500 dark:text-zinc-400 mb-1">Amount (USD)</div>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-white"
                placeholder="0.00"
              />
            </label>
            <label className="text-xs">
              <div className="text-gray-500 dark:text-zinc-400 mb-1">Date</div>
              <input
                type="date"
                required
                value={paidAt}
                onChange={e => setPaidAt(e.target.value)}
                className="w-full px-3 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-white"
              />
            </label>
            <label className="text-xs">
              <div className="text-gray-500 dark:text-zinc-400 mb-1">Note (optional)</div>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-3 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-white"
                placeholder="Wire transfer, PayPal, etc."
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold rounded-md bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white transition"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        )}

        {payouts.length === 0 ? (
          <div className="text-xs text-gray-300 dark:text-zinc-700">No payouts recorded yet.</div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-zinc-800">
            {payouts.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{fmt$(Number(p.amount))}</div>
                  <div className="text-xs text-gray-400 dark:text-zinc-500">
                    {fmtDate(p.paid_at)}{p.note ? ` · ${p.note}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => deletePayout(p.id)}
                  className="text-xs text-gray-400 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
