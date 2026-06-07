import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { VideoCard, type VideoCardData } from '@/components/video-card'
import { ChannelStrip, type ChannelStat } from '@/components/channel-strip'
import type { Summary } from '@/lib/llm/openai'

interface PageProps {
  searchParams: Promise<{ channel?: string }>
}

interface VideoRow {
  video_id: string
  title: string | null
  url: string | null
  published_at: string | null
  channel_id: string
  summary: Summary | null
  channels: { title: string | null } | { title: string | null }[] | null
}

export const dynamic = 'force-dynamic'

export default async function HomePage({ searchParams }: PageProps) {
  const { channel } = await searchParams
  const supabase = createServerSupabaseClient()

  // 채널 칩에 표시할 카운트는 필터와 무관하게 항상 "모든 요약된 영상" 기준이어야 한다.
  // → 영상 목록은 두 번 가져온다: (a) 카운트 집계용 전체, (b) 화면용 필터링본.
  // subscriptions 는 ChannelStrip 의 진실 공급원이기도 하다 — 구독 중인 채널만 strip 에 보인다.
  const [allVideosRes, channelsRes, subsRes] = await Promise.all([
    supabase
      .from('videos')
      .select('video_id, channel_id, published_at')
      .not('summary', 'is', null),
    supabase
      .from('channels')
      .select('channel_id, title')
      .order('title', { ascending: true }),
    supabase
      .from('subscriptions')
      .select('channel_id, last_checked'),
  ])

  let displayQuery = supabase
    .from('videos')
    .select(
      `
        video_id, title, url, published_at, channel_id, summary,
        channels ( title )
      `,
    )
    .not('summary', 'is', null)
    .order('published_at', { ascending: false })
  if (channel) displayQuery = displayQuery.eq('channel_id', channel)
  const videosRes = await displayQuery

  const channelsMeta = channelsRes.data ?? []
  const allVideos = allVideosRes.data ?? []
  const subs = subsRes.data ?? []
  const subscribedChannelIds = new Set(subs.map((s) => s.channel_id))
  const totalCount = allVideos.length

  // 마지막 자동 확인 시각 = subscriptions 의 last_checked 중 가장 최근 값.
  // 한국 시각 기준 "MM/DD HH:mm" (서버에서 고정 문자열로 만들어 hydration 안전).
  const lastCheckedIso = subs.reduce<string | null>((acc, s) => {
    const v = s.last_checked
    if (!v) return acc
    if (!acc || v > acc) return v
    return acc
  }, null)
  const lastCheckedLabel = (() => {
    if (!lastCheckedIso) return null
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(lastCheckedIso))
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '??'
    return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
  })()

  // 채널별 집계 — "구독 중인 채널만" 포함. 구독 해지된 채널은 strip 에서 사라진다.
  const statMap = new Map<string, ChannelStat>()
  for (const ch of channelsMeta) {
    if (!subscribedChannelIds.has(ch.channel_id)) continue
    statMap.set(ch.channel_id, {
      channel_id: ch.channel_id,
      title: ch.title,
      count: 0,
      latestAt: null,
    })
  }
  for (const v of allVideos) {
    const entry = statMap.get(v.channel_id)
    if (!entry) continue
    entry.count += 1
    const ts = v.published_at ?? null
    if (ts && (!entry.latestAt || ts > entry.latestAt)) entry.latestAt = ts
  }
  // 구독 중인 모든 채널을 strip 에 노출. 요약 영상이 아직 없는 신규 등록 채널도 보이고,
  // 구독 해지된 채널은 (subscriptions 에 없으면 statMap 에 없으므로) 사라진다.
  // → ChannelStrip 의 진실 공급원이 subscriptions/channels 가 되도록.
  // 활동 있는 채널을 먼저, 신규(영상 0개) 채널을 뒤에 둔다.
  const channelStats: ChannelStat[] = Array.from(statMap.values()).sort(
    (a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''),
  )

  const videoRows = (videosRes.data ?? []) as VideoRow[]
  const videos: VideoCardData[] = videoRows
    .filter((v): v is VideoRow & { summary: Summary } => v.summary !== null)
    .map((v) => {
      const channelTitle = Array.isArray(v.channels)
        ? (v.channels[0]?.title ?? null)
        : (v.channels?.title ?? null)
      return {
        video_id: v.video_id,
        title: v.title,
        url: v.url,
        published_at: v.published_at,
        channelTitle,
        summary: v.summary,
      }
    })

  const activeChannelTitle = channel
    ? (statMap.get(channel)?.title ?? null)
    : null

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            TubeBrief
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            구독한 유튜브 채널의 신규 영상을 자동으로 요약해 모아둡니다.
            <span className="ml-1.5 font-medium text-foreground">{totalCount}</span>
            개 영상 요약 보관 중.
            {lastCheckedLabel ? (
              <span className="ml-1.5">· 마지막 자동 확인 {lastCheckedLabel}</span>
            ) : (
              <span className="ml-1.5">· 자동 확인 기록 없음</span>
            )}
          </p>
        </div>
        <Link
          href="/channels"
          className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
        >
          채널 관리 →
        </Link>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          채널
        </h2>
        <ChannelStrip
          channels={channelStats}
          totalCount={totalCount}
          activeChannel={channel}
        />
      </section>

      {channel && (
        <div className="mb-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {activeChannelTitle ?? '(이름 없음)'}
          </span>
          <span className="ml-1.5">· {videos.length}건</span>
        </div>
      )}

      {videos.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          {channel
            ? '이 채널에 대해 요약된 영상이 없어요.'
            : '아직 요약된 영상이 없어요. /api/channels 로 채널을 등록하고 /api/refresh → /api/process → /api/summarize 를 차례로 호출해 보세요.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <VideoCard key={v.video_id} video={v} />
          ))}
        </div>
      )}
    </main>
  )
}
