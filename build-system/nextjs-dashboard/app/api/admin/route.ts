import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const PRICE_PER_LICENSE = 149
const LAUNCH_DATE = new Date('2026-03-12T00:00:00.000Z')
const PAYMENT_FEE_RATE = 0.04

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  if (!await requireAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'stats') {
    const [lRes, uRes] = await Promise.all([
      db.from('licenses').select('id, is_active, is_free, created_at'),
      db.from('license_usage').select('id, used_at'),
    ])
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const postLaunch = lRes.data?.filter(l => new Date(l.created_at) >= LAUNCH_DATE) ?? []
    return NextResponse.json({
      totalLicenses: lRes.data?.length ?? 0,
      activeLicenses: lRes.data?.filter(l => l.is_active).length ?? 0,
      totalUsage: uRes.data?.length ?? 0,
      usageToday: uRes.data?.filter(u => new Date(u.used_at) >= today).length ?? 0,
      usageThisWeek: uRes.data?.filter(u => new Date(u.used_at) >= weekAgo).length ?? 0,
      paidLicenses: postLaunch.filter(l => !l.is_free).length,
      freeLicenses: postLaunch.filter(l => l.is_free).length,
    })
  }

  if (type === 'licenses') {
    const { data, error } = await db
      .from('licenses')
      .select('*, license_usage(count)')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'usage') {
    const { data, error } = await db
      .from('license_usage')
      .select('*, licenses(license_code, email, name)')
      .order('used_at', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'payouts') {
    const { data, error } = await db
      .from('payouts')
      .select('*')
      .order('paid_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (type === 'revenue') {
    const [licRes, payRes] = await Promise.all([
      db.from('licenses')
        .select('id, license_code, email, name, created_at, is_free, is_active, price')
        .order('created_at', { ascending: false }),
      db.from('payouts').select('recipient, amount'),
    ])
    const { data: licenses, error } = licRes
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (payRes.error) return NextResponse.json({ error: payRes.error.message }, { status: 500 })

    const postLaunch = (licenses ?? []).filter(l => new Date(l.created_at) >= LAUNCH_DATE)
    const paid = postLaunch.filter(l => !l.is_free)
    const free = postLaunch.filter(l => l.is_free)
    const totalRevenue = paid.reduce((sum, l) => sum + (l.price ?? PRICE_PER_LICENSE), 0)

    const byMonthMap: Record<string, { revenue: number; count: number }> = {}
    paid.forEach(l => {
      const key = new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      if (!byMonthMap[key]) byMonthMap[key] = { revenue: 0, count: 0 }
      byMonthMap[key].revenue += l.price ?? PRICE_PER_LICENSE
      byMonthMap[key].count += 1
    })
    const byMonth = Object.entries(byMonthMap)
      .map(([month, d]) => ({ month, ...d }))
      .reverse()

    // Biweekly breakdown
    const byBiweekMap: Record<string, { revenue: number; count: number }> = {}
    paid.forEach(l => {
      const d = new Date(l.created_at)
      const half = d.getDate() <= 15 ? '1-15' : '16-' + new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const key = `${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${half})`
      if (!byBiweekMap[key]) byBiweekMap[key] = { revenue: 0, count: 0 }
      byBiweekMap[key].revenue += l.price ?? PRICE_PER_LICENSE
      byBiweekMap[key].count += 1
    })
    const byBiweek = Object.entries(byBiweekMap)
      .map(([period, d]) => ({ period, ...d }))
      .reverse()

    const paymentFees = totalRevenue * PAYMENT_FEE_RATE
    const netRevenue = totalRevenue - paymentFees
    const gabrielShare = netRevenue * 0.5
    const ferShare = netRevenue * 0.5
    const gabrielPaidOut = (payRes.data ?? [])
      .filter(p => p.recipient === 'Gabriel Fordan')
      .reduce((s, p) => s + Number(p.amount), 0)
    const gabrielBalance = gabrielShare - gabrielPaidOut

    return NextResponse.json({
      totalRevenue,
      paymentFees,
      netRevenue,
      gabrielShare,
      ferShare,
      gabrielPaidOut,
      gabrielBalance,
      paidCount: paid.length,
      freeCount: free.length,
      pricePerLicense: PRICE_PER_LICENSE,
      launchDate: '2026-03-12',
      byMonth,
      byBiweek,
      recentPaid: paid.slice(0, 10).map(l => ({ ...l, price: l.price ?? PRICE_PER_LICENSE })),
    })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  if (!await requireAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const type = req.nextUrl.searchParams.get('type')
  const body = await req.json()

  if (type === 'payout') {
    const amount = Number(body.amount)
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    const { data, error } = await db.from('payouts').insert({
      recipient: body.recipient || 'Gabriel Fordan',
      amount,
      paid_at: body.paid_at || new Date().toISOString(),
      note: body.note || null,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

export async function PATCH(req: NextRequest) {
  if (!await requireAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const body = await req.json()
  const { id, is_active, is_free } = body
  const updates: Record<string, unknown> = {}
  if (is_active !== undefined) updates.is_active = is_active
  if (is_free !== undefined) updates.is_free = is_free
  if (body.price !== undefined) updates.price = body.price
  const { data, error } = await db.from('licenses').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!await requireAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createAdminClient()
  const type = req.nextUrl.searchParams.get('type')
  const { id } = await req.json()
  const table = type === 'payout' ? 'payouts' : 'licenses'
  const { error } = await db.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
