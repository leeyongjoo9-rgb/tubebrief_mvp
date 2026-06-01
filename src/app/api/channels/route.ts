import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveChannelId } from '@/lib/youtube/channelId'
import { fetchChannelRss } from '@/lib/youtube/rss'
import { requireCronAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface RegisterBody {
  url?: string
  label?: string
  include_keywords?: string[]
  exclude_keywords?: string[]
}

export async function POST(req: NextRequest) {
  const authFail = requireCronAuth(req)
  if (authFail) return authFail

  let body: RegisterBody | null = null
  try {
    body = (await req.json()) as RegisterBody
  } catch {
    return NextResponse.json(
      {
        error:
          'JSON body 가 필요해요. 예: { "url": "https://www.youtube.com/@somechannel", "label": "전체 구독" } 또는 { "url": "...", "label": "뉴스하이킥-곽상준", "include_keywords": ["[뉴스하이킥]", "곽상준"] }',
      },
      { status: 400 },
    )
  }

  const input = typeof body?.url === 'string' ? body.url : null
  if (!input) {
    return NextResponse.json(
      { error: 'body.url (문자열) 이 필요해요.' },
      { status: 400 },
    )
  }

  const includeKeywords = Array.isArray(body?.include_keywords)
    ? body.include_keywords.filter((k): k is string => typeof k === 'string')
    : []
  const excludeKeywords = Array.isArray(body?.exclude_keywords)
    ? body.exclude_keywords.filter((k): k is string => typeof k === 'string')
    : []
  const label =
    typeof body?.label === 'string' && body.label.trim()
      ? body.label.trim()
      : null

  try {
    const resolved = await resolveChannelId(input)

    let channelTitle = resolved.title
    try {
      const rss = await fetchChannelRss(resolved.channelId)
      if (rss.channelTitle) channelTitle = rss.channelTitle
    } catch {
      // 채널 메타 제목은 부가 정보. RSS 실패해도 등록은 계속.
    }

    const supabase = createServerSupabaseClient()

    // 1) 채널 upsert
    const { data: channel, error: chErr } = await supabase
      .from('channels')
      .upsert(
        {
          channel_id: resolved.channelId,
          title: channelTitle ?? null,
          url: resolved.url,
        },
        { onConflict: 'channel_id' },
      )
      .select()
      .single()
    if (chErr) {
      return NextResponse.json({ error: chErr.message }, { status: 500 })
    }

    // 2) 구독 생성. label 미지정이면 채널명 + 키워드 요약으로 자동 생성.
    const autoLabel =
      label ??
      (includeKeywords.length > 0
        ? `${channelTitle ?? resolved.channelId} - ${includeKeywords.join('+')}`
        : (channelTitle ?? resolved.channelId))

    const { data: subscription, error: subErr } = await supabase
      .from('subscriptions')
      .insert({
        channel_id: resolved.channelId,
        label: autoLabel,
        include_keywords: includeKeywords,
        exclude_keywords: excludeKeywords,
      })
      .select()
      .single()
    if (subErr) {
      return NextResponse.json({ error: subErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, channel, subscription })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

export async function GET() {
  const supabase = createServerSupabaseClient()
  const [channelsRes, subsRes] = await Promise.all([
    supabase
      .from('channels')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  if (channelsRes.error) {
    return NextResponse.json(
      { error: channelsRes.error.message },
      { status: 500 },
    )
  }
  if (subsRes.error) {
    return NextResponse.json(
      { error: subsRes.error.message },
      { status: 500 },
    )
  }
  return NextResponse.json({
    channels: channelsRes.data ?? [],
    subscriptions: subsRes.data ?? [],
  })
}
