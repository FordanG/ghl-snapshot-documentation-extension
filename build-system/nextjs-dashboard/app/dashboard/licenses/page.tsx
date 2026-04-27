'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { mutate } from 'swr'
import { useLicenses, KEYS, revalidateAll } from '@/lib/swr'

interface License {
  id: string
  license_code: string
  email: string | null
  name: string | null
  max_uses: number | null
  is_active: boolean
  is_free: boolean
  price: number | null
  created_at: string
  expires_at: string | null
  notes: string | null
  license_usage: Array<{ count: number }>
}

const LAUNCH_DATE = new Date('2026-03-12T00:00:00.000Z')

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LicensesPage() {
  const { data: licensesRaw, isLoading: loading } = useLicenses()
  const licenses: License[] = Array.isArray(licensesRaw) ? licensesRaw : []
  const [filtered, setFiltered] = useState<License[]>([])
  const [search, setSearch] = useState('')
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState('')

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(licenses.filter(l =>
      (l.license_code || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.name || '').toLowerCase().includes(q)
    ))
  }, [search, licenses])

  async function patch(id: string, fields: Record<string, unknown>) {
    // Optimistic update
    const optimistic = licenses.map(l =>
      l.id === id ? { ...l, ...fields } : l
    )
    mutate(KEYS.licenses, optimistic, false)

    await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })

    // Revalidate licenses + stats (stats reflect active counts)
    revalidateAll()
  }

  async function deleteLicense(id: string, code: string) {
    if (!confirm(`Delete license ${code}? This cannot be undone.`)) return

    // Optimistic removal
    const optimistic = licenses.filter(l => l.id !== id)
    mutate(KEYS.licenses, optimistic, false)

    await fetch('/api/admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })

    revalidateAll()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Licenses</h1>
          <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">{licenses.length} total licenses</p>
        </div>
        <Link
          href="/dashboard/generate"
          className="bg-gradient-to-r from-violet-700 to-violet-500 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition"
        >
          + Generate License
        </Link>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800">
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by email, name, or license key…"
            className="w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {loading ? (
          <div className="text-center text-gray-400 text-sm py-16">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-16">No licenses found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30">
                  {['License Key', 'Customer', 'Uses', 'Expires', 'Created', 'Status', 'Revenue', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const usageCount = l.license_usage?.[0]?.count ?? 0
                  const uses = l.max_uses ? `${usageCount} / ${l.max_uses}` : String(usageCount)
                  const isPostLaunch = new Date(l.created_at) >= LAUNCH_DATE
                  return (
                    <tr key={l.id} className="border-b border-gray-50 dark:border-zinc-800 hover:bg-violet-50/20 dark:hover:bg-violet-900/10 transition">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-violet-700 dark:text-violet-400 whitespace-nowrap">
                        {l.license_code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-gray-800 dark:text-zinc-200">{l.name || '—'}</div>
                        <div className="text-xs text-gray-400 dark:text-zinc-500">{l.email || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">{uses}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                        {l.expires_at ? fmtDate(l.expires_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                        {fmtDate(l.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                          l.is_active
                            ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
                            : 'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400'
                        }`}>
                          {l.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!isPostLaunch ? (
                          <span className="text-xs text-gray-300 dark:text-zinc-600">Pre-launch</span>
                        ) : l.is_free ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                            🎁 Free
                          </span>
                        ) : editingPriceId === l.id ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            autoFocus
                            value={editingPriceValue}
                            onChange={e => setEditingPriceValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const val = parseFloat(editingPriceValue)
                                if (!isNaN(val) && val >= 0) patch(l.id, { price: val })
                                setEditingPriceId(null)
                              }
                              if (e.key === 'Escape') setEditingPriceId(null)
                            }}
                            onBlur={() => {
                              const val = parseFloat(editingPriceValue)
                              if (!isNaN(val) && val >= 0) patch(l.id, { price: val })
                              setEditingPriceId(null)
                            }}
                            className="w-16 px-1.5 py-0.5 text-xs font-semibold rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
                          />
                        ) : (
                          <span
                            onClick={() => { setEditingPriceId(l.id); setEditingPriceValue(String(l.price ?? 97)) }}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 cursor-pointer hover:ring-1 hover:ring-violet-400 transition"
                            title="Click to edit price"
                          >
                            ${l.price ?? 97}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => patch(l.id, { is_active: !l.is_active })}
                            className="text-xs text-gray-400 dark:text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 transition font-medium whitespace-nowrap"
                          >
                            {l.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          {isPostLaunch && (
                            <button
                              onClick={() => patch(l.id, { is_free: !l.is_free })}
                              className="text-xs text-gray-400 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition font-medium whitespace-nowrap"
                            >
                              {l.is_free ? 'Mark paid' : 'Mark free'}
                            </button>
                          )}
                          <button
                            onClick={() => deleteLicense(l.id, l.license_code)}
                            className="text-xs text-gray-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
