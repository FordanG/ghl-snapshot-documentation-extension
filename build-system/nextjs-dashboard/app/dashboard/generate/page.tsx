'use client'

import { useState } from 'react'
import { revalidateAll } from '@/lib/swr'

interface GeneratedLicense {
  license_code: string
  email: string
  is_free: boolean
}

export default function GeneratePage() {
  const [email, setEmail]       = useState('')
  const [name, setName]         = useState('')
  const [maxUses, setMaxUses]   = useState('')
  const [expires, setExpires]   = useState('')
  const [notes, setNotes]       = useState('')
  const [isFree, setIsFree]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState<{
    license: GeneratedLicense
    emailSent: boolean
    warning?: string
  } | null>(null)

  async function generate(sendEmail: boolean) {
    if (!email) { setError('Email is required.'); return }
    setError('')
    setSuccess(null)
    setLoading(true)

    const payload: Record<string, unknown> = { email, send_email: sendEmail, is_free: isFree }
    if (name)    payload.name     = name
    if (maxUses) payload.max_uses = parseInt(maxUses)
    if (expires) payload.expires_at = expires
    if (notes)   payload.notes    = notes

    try {
      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
      } else {
        setSuccess({ license: data.license, emailSent: sendEmail, warning: data.warning })
        setEmail(''); setName(''); setMaxUses(''); setExpires(''); setNotes(''); setIsFree(false)
        // Revalidate all dashboard caches so other pages reflect the new license
        revalidateAll()
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  const inputCls = 'w-full border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
  const labelCls = 'block text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-1.5'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Generate License</h1>
        <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">Create a new license key for a customer</p>
      </div>

      {success && (
        <div className="mb-5 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-5 max-w-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-green-800 dark:text-green-300 font-semibold text-sm mb-1">License created!</div>
              <div className="text-green-700 dark:text-green-400 text-xs mb-3 space-y-0.5">
                <div>{success.emailSent ? `Email sent to ${success.license.email}.` : 'Created without sending email.'}</div>
                {success.license.is_free && (
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">🎁 Free</span>
                    <span className="text-gray-500 dark:text-zinc-500">— not counted in revenue</span>
                  </div>
                )}
                {success.warning && <div className="text-orange-600 dark:text-orange-400">{success.warning}</div>}
              </div>
              <div className="font-mono text-lg font-bold text-green-800 dark:text-green-300 tracking-widest bg-green-100 dark:bg-green-900 rounded-lg px-4 py-2.5 inline-block select-all">
                {success.license.license_code}
              </div>
            </div>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600 text-lg leading-none mt-0.5 flex-shrink-0">✕</button>
          </div>
        </div>
      )}

      <div className="max-w-lg bg-white dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800 p-6">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Email <span className="text-red-400">*</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="customer@example.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Max Uses</label>
              <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Unlimited" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expires At</label>
              <input type="date" value={expires} onChange={e => setExpires(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes…" rows={2} className={`${inputCls} resize-none`} />
          </div>

          {/* Free license toggle */}
          <div
            onClick={() => setIsFree(!isFree)}
            className={`flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer transition ${
              isFree
                ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600'
            }`}
          >
            <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isFree ? 'bg-amber-400' : 'bg-gray-200 dark:bg-zinc-600'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${isFree ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-zinc-200">Free license 🎁</div>
              <div className="text-xs text-gray-400 dark:text-zinc-500">Not counted toward revenue metrics</div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg p-3">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => generate(true)} disabled={loading}
              className="flex-1 bg-gradient-to-r from-violet-700 to-violet-500 text-white rounded-lg py-3 font-semibold text-sm hover:opacity-90 transition disabled:opacity-50">
              {loading ? 'Generating…' : 'Generate & Send Email'}
            </button>
            <button onClick={() => generate(false)} disabled={loading}
              className="flex-1 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg py-3 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition disabled:opacity-50">
              Generate Only
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-zinc-500 text-center">
            &quot;Generate Only&quot; creates the license without sending an email.
          </p>
        </div>
      </div>
    </div>
  )
}
