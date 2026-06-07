import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { processVideo, type ProcessResult } from '@/lib/processVideo'
import { requireCronAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const authFail = requireCronAuth(req)
  if (authFail) return authFail

  let limit: number | null = null
  let channelId: string | null = null
  const body = await req.json().catch(() => null)
  if (body && typeof body === 'object') {
    const cid = (body as { channelId?: unknown }).channelId
    if (typeof cid === 'string' && cid.length > 0) channelId = cid
  }
  if (
    body &&
    typeof body === 'object' &&
    'limit' in body &&
    typeof (body as { limit: unknown }).limit === 'number' &&
    (body as { limit: number }).limit > 0
  ) {
    limit = (body as { limit: number }).limit
  }

  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('videos')
    .select('video_id, channel_id, title')
    .eq('status', 'pending')
    .order('published_at', { ascending: false })

  if (channelId) query = query.eq('channel_id', channelId)
  if (limit) query = query.limit(limit)

  const { data: pending, error: pendingErr } = await query
  if (pendingErr) {
    return NextResponse.json({ error: pendingErr.message }, { status: 500 })
  }
  if (!pending || pending.length === 0) {
    return NextResponse.json({
      ok: true,
      message: '처리할 pending 영상이 없어요.',
      counts: { transcript_ok: 0, metadata_fallback: 0, failed: 0 },
      results: [],
    })
  }

  const results: ProcessResult[] = []
  for (const v of pending) {
    const r = await processVideo({
      video_id: v.video_id,
      channel_id: v.channel_id,
      title: v.title,
    })
    results.push(r)
  }

  const counts = {
    transcript_ok: results.filter((r) => r.status === 'transcript_ok').length,
    metadata_fallback: results.filter((r) => r.status === 'metadata_fallback')
      .length,
    failed: results.filter((r) => r.status === 'failed').length,
  }

  return NextResponse.json({ ok: true, counts, results })
}

// Vercel Cron 은 GET 으로만 호출되므로 POST 와 동일 로직을 수행한다.
export async function GET(req: NextRequest) {
  return POST(req)
}
