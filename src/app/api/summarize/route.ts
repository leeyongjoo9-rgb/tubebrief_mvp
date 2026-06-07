import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  summarizeAndStoreVideo,
  type SummarizeVideoResult,
} from '@/lib/summarizeVideo'
import { requireCronAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// gpt-5-mini 가격 추정 (/1M tokens) — 정확치는 OpenAI 공식 페이지 확인 필요
const PRICE_INPUT = 0.25
const PRICE_OUTPUT = 2.0

interface TranscriptRow {
  source: string
  language: string | null
  content: string
  segments: Array<{ start: number; dur: number; text: string }> | null
}

export async function POST(req: NextRequest) {
  const authFail = requireCronAuth(req)
  if (authFail) return authFail

  let limit: number | null = null
  let force = false
  let channelId: string | null = null
  let videoId: string | null = null
  const body = await req.json().catch(() => null)
  if (body && typeof body === 'object') {
    const limitVal = (body as { limit?: unknown }).limit
    if (typeof limitVal === 'number' && limitVal > 0) limit = limitVal
    const forceVal = (body as { force?: unknown }).force
    if (forceVal === true) force = true
    const cid = (body as { channelId?: unknown }).channelId
    if (typeof cid === 'string' && cid.length > 0) channelId = cid
    const vid = (body as { videoId?: unknown }).videoId
    if (typeof vid === 'string' && vid.length > 0) videoId = vid
  }

  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('videos')
    .select(
      `
        video_id,
        title,
        status,
        transcripts ( source, language, content, segments )
      `,
    )
    .in('status', ['transcript_ok', 'metadata_fallback'])
    .order('published_at', { ascending: false })

  if (!force) query = query.is('summary', null)
  if (channelId) query = query.eq('channel_id', channelId)
  if (videoId) query = query.eq('video_id', videoId)
  if (limit) query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({
      ok: true,
      message:
        '요약할 영상이 없어요. (status=transcript_ok 또는 metadata_fallback 이면서 summary 가 null 인 영상)',
      counts: { ok: 0, failed: 0 },
      tokens: { input: 0, output: 0, total: 0 },
      estimatedCostUSD: 0,
      results: [],
    })
  }

  const results: SummarizeVideoResult[] = []
  let inputTok = 0
  let outputTok = 0

  for (const v of data) {
    const tArr = Array.isArray(v.transcripts)
      ? (v.transcripts as TranscriptRow[])
      : v.transcripts
        ? [v.transcripts as TranscriptRow]
        : []
    const t = tArr[0]

    if (!t) {
      results.push({
        videoId: v.video_id,
        ok: false,
        error: '연결된 transcripts 행을 찾을 수 없어요.',
      })
      continue
    }

    const sourceType: 'transcript' | 'metadata' =
      t.source === 'youtube-auto' || t.source === 'youtube-manual'
        ? 'transcript'
        : 'metadata'

    const r = await summarizeAndStoreVideo({
      video_id: v.video_id,
      title: v.title,
      source_type: sourceType,
      content: t.content,
      language: t.language,
      segments: t.segments,
    })
    results.push(r)
    if (r.tokens) {
      inputTok += r.tokens.input
      outputTok += r.tokens.output
    }
  }

  const ok = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  const inputCost = (inputTok / 1_000_000) * PRICE_INPUT
  const outputCost = (outputTok / 1_000_000) * PRICE_OUTPUT
  const totalCost = Math.round((inputCost + outputCost) * 10000) / 10000

  return NextResponse.json({
    ok: true,
    counts: { ok, failed },
    tokens: {
      input: inputTok,
      output: outputTok,
      total: inputTok + outputTok,
    },
    estimatedCostUSD: totalCost,
    results,
  })
}

// Vercel Cron 은 GET 으로만 호출되므로 POST 와 동일 로직을 수행한다.
export async function GET(req: NextRequest) {
  return POST(req)
}
