import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchChannelRss, type RssVideo } from '@/lib/youtube/rss'
import { requireCronAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface SubscriptionSummary {
  subscriptionId: string
  label: string | null
  channelId: string
  fetched: number
  matched: number
  inserted: number
  error?: string
}

interface Subscription {
  id: string
  channel_id: string
  label: string | null
  include_keywords: string[]
  exclude_keywords: string[]
}

// 영상 제목이 include_keywords 를 "모두" 포함하고 exclude_keywords 를 "전혀" 포함하지 않으면 매치.
function matchSubscription(title: string | null, sub: Subscription): boolean {
  const t = title ?? ''
  for (const kw of sub.include_keywords) {
    if (!t.includes(kw)) return false
  }
  for (const kw of sub.exclude_keywords) {
    if (t.includes(kw)) return false
  }
  return true
}

export async function POST(req: NextRequest) {
  const authFail = requireCronAuth(req)
  if (authFail) return authFail

  const supabase = createServerSupabaseClient()

  const { data: subs, error: subErr } = await supabase
    .from('subscriptions')
    .select('id, channel_id, label, include_keywords, exclude_keywords')

  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 })
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({
      ok: true,
      message:
        '등록된 구독이 없어요. 먼저 POST /api/channels 로 채널과 구독을 등록하세요.',
      summary: [],
    })
  }

  const subscriptions = subs as Subscription[]

  // 같은 channel_id 에 여러 구독이 있어도 RSS 는 한 번만 가져온다.
  const channelIds = [...new Set(subscriptions.map((s) => s.channel_id))]
  const rssCache = new Map<string, RssVideo[]>()
  const rssErrors = new Map<string, string>()

  for (const channelId of channelIds) {
    try {
      const rss = await fetchChannelRss(channelId)
      rssCache.set(channelId, rss.videos)
    } catch (err) {
      rssErrors.set(
        channelId,
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  const summary: SubscriptionSummary[] = []
  const nowIso = new Date().toISOString()

  for (const sub of subscriptions) {
    const entry: SubscriptionSummary = {
      subscriptionId: sub.id,
      label: sub.label,
      channelId: sub.channel_id,
      fetched: 0,
      matched: 0,
      inserted: 0,
    }

    const videos = rssCache.get(sub.channel_id)
    if (!videos) {
      entry.error = rssErrors.get(sub.channel_id) ?? 'RSS 캐시에 없음'
      summary.push(entry)
      continue
    }
    entry.fetched = videos.length

    try {
      const matchedVideos = videos.filter((v) =>
        matchSubscription(v.title, sub),
      )
      entry.matched = matchedVideos.length

      if (matchedVideos.length > 0) {
        const ids = matchedVideos.map((v) => v.videoId)
        const { data: existing, error: existingErr } = await supabase
          .from('videos')
          .select('video_id')
          .in('video_id', ids)
        if (existingErr) throw existingErr

        const existingSet = new Set(existing?.map((e) => e.video_id) ?? [])
        const newVideos = matchedVideos.filter(
          (v) => !existingSet.has(v.videoId),
        )

        if (newVideos.length > 0) {
          const rows = newVideos.map((v) => ({
            video_id: v.videoId,
            channel_id: sub.channel_id,
            title: v.title,
            url: v.url,
            published_at: v.publishedAt,
            status: 'pending' as const,
          }))
          const { error: insertErr } = await supabase.from('videos').insert(rows)
          if (insertErr) throw insertErr
          entry.inserted = newVideos.length
        }
      }

      await supabase
        .from('subscriptions')
        .update({ last_checked: nowIso })
        .eq('id', sub.id)
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err)
    }

    summary.push(entry)
  }

  // 채널 단위 last_checked 도 호환 차원에서 갱신.
  if (channelIds.length > 0) {
    await supabase
      .from('channels')
      .update({ last_checked: nowIso })
      .in('channel_id', channelIds)
  }

  return NextResponse.json({ ok: true, summary })
}

// Vercel Cron 은 GET 으로만 호출되므로 POST 와 동일 로직을 수행한다.
export async function GET(req: NextRequest) {
  return POST(req)
}
