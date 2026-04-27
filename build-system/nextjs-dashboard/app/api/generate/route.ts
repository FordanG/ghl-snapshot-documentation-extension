import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const EDGE_URL = 'https://aggtrjiseqoeottcrbuw.supabase.co/functions/v1'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const res = await fetch(`${EDGE_URL}/generate-license`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ADMIN_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return NextResponse.json(await res.json(), { status: res.status })
}
